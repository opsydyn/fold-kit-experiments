import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NodeServices } from '@effect/platform-node';
import {
  captureModelDocument,
  captureEdition,
  serializeModelDocument,
  createEventStormingPattern,
  serializeGraph,
  eventStormingRelationshipRules,
} from '@opsydyn/foldkit-zloz';
import { Cause, Effect, Exit, Runtime, Sink, Stdio, Stream } from 'effect';

import { run } from '../src/index';

const empty = '{"version":1,"graph":{"nodes":[],"edges":[]}}';
const graph =
  '{"version":1,"graph":{"nodes":[{"id":"支付","label":"Payments","position":{"x":0,"y":0},"size":{"width":200,"height":100},"ports":[]}],"edges":[]}}';
async function invoke(args: readonly string[], input: string) {
  const output: string[] = [];
  const exit = await Effect.runPromise(
    run(args).pipe(
      Effect.provide(
        Stdio.layerTest({
          stdinIsTerminal: Effect.succeed(false),
          stdin: Stream.succeed(new TextEncoder().encode(input)),
          stdout: () =>
            Sink.forEach((value: string | Uint8Array) =>
              Effect.sync(() => {
                output.push(String(value));
              }),
            ),
        }),
      ),
      Effect.provide(NodeServices.layer),
      Effect.exit,
    ),
  );
  const code = Exit.isFailure(exit) ? Runtime.getErrorExitCode(Cause.squash(exit.cause)) : 0;
  return { code, text: output.join('') };
}

test('validate emits one stable JSON result without changing a version-one document', async () => {
  const result = await invoke(['validate'], empty);
  expect(result.code).toBe(0);
  expect(result.text).toBe(
    JSON.stringify({
      protocol: 'foldkit-zloz-cli/v1',
      operation: 'validate',
      status: 'valid',
      summary: { nodes: 0, edges: 0 },
      diagnostics: [],
    }) + '\n',
  );
});

test('losses reject by default and report preserves Unicode identity and chosen direction', async () => {
  const strict = await invoke(['mermaid', 'export'], graph);
  expect(strict.code).toBe(1);
  expect(JSON.parse(strict.text).status).toBe('rejected');
  expect(JSON.parse(strict.text).diagnostics.map((item: { code: string }) => item.code)).toContain(
    'layout-omitted',
  );
  const reported = await invoke(
    ['mermaid', 'export', '--loss-policy', 'report', '--direction', 'TB'],
    graph,
  );
  expect(reported.code).toBe(0);
  const output = JSON.parse(reported.text);
  expect(output.status).toBe('converted');
  expect(output.data.source).toStartWith('flowchart TB\n');
  expect(output.data.identity.nodes[0].flowId).toBe('支付');
});

test('invalid JSON and unsupported graph versions emit input diagnostics and exit 2', async () => {
  for (const input of ['{bad', '{"version":2,"nodes":[],"edges":[]}']) {
    const result = await invoke(['validate'], input);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.text).status).toBe('rejected');
  }
});

test('model validation preserves identity metadata and Mermaid projection losses require consent', async () => {
  const model = captureModelDocument({
    id: 'model-a',
    name: 'Alternative',
    snapshot: { graph: { nodes: [], edges: [] }, viewport: { x: 1, y: 2, zoom: 1 } },
    editions: [],
    origin: null,
  });
  const input = serializeModelDocument(model);
  const validated = await invoke(['validate'], input);
  expect(validated.code).toBe(0);
  expect(JSON.parse(validated.text).model).toEqual({
    id: 'model-a',
    name: 'Alternative',
    editions: 0,
    origin: null,
  });
  const strict = await invoke(['mermaid', 'export'], input);
  expect(strict.code).toBe(1);
  expect(JSON.parse(strict.text).diagnostics.map((d: { code: string }) => d.code)).toContain(
    'model-metadata-omitted',
  );
  const report = await invoke(['mermaid', 'export', '--loss-policy', 'report'], input);
  expect(report.code).toBe(0);
  expect(JSON.parse(report.text).diagnostics.map((d: { code: string }) => d.code)).toContain(
    'model-metadata-omitted',
  );
  expect(input).toBe(serializeModelDocument(model));
  const bad = JSON.parse(input);
  bad.version = 99;
  expect((await invoke(['validate'], JSON.stringify(bad))).code).toBe(2);
});
test('snapshot camera loss is explicit even for an empty graph', async () => {
  const input = JSON.stringify({
    version: 1,
    graph: { nodes: [], edges: [] },
    viewport: { x: 1, y: 2, zoom: 1 },
  });
  const strict = await invoke(['mermaid', 'export'], input);
  expect(strict.code).toBe(1);
  expect(JSON.parse(strict.text).diagnostics[0].code).toBe('viewport-omitted');
});

test('relationship audit is an Effect command with a distinct audited response', async () => {
  const result = await invoke(['relationships', 'audit'], empty);
  expect(result.code).toBe(0);
  const response = JSON.parse(result.text);
  expect(response.operation).toBe('relationships-audit');
  expect(response.status).toBe('audited');
  expect(response.data.summary).toEqual({
    edges: 0,
    typed: 0,
    inferred: 0,
    unrelated: 0,
    blocked: 0,
  });
});

test('audit distinguishes compatibility exit 1 from malformed-input exit 2 and scopes model input to the live graph', async () => {
  const value = createEventStormingPattern();
  const first = value.edges[0];
  assert(first, 'Missing edge');
  const bad = {
    ...value,
    edges: [
      { ...first, architecture: { family: 'event-storming' as const, role: 'emits' as const } },
    ],
  };
  const incompatible = await invoke(['relationships', 'audit'], serializeGraph(bad));
  expect(incompatible.code).toBe(1);
  const response = JSON.parse(incompatible.text);
  expect(response.status).toBe('audited');
  expect(response.data.status).toBe('incompatible');
  expect(response.diagnostics[0]).toMatchObject({
    code: 'relationship-incompatible-roles',
    subject: first.id,
    severity: 'error',
    dimension: 'semantics',
  });
  const invalid = await invoke(['relationships', 'audit'], '{bad');
  expect(invalid.code).toBe(2);
  expect(JSON.parse(invalid.text).diagnostics[0].code).toBe('invalid-json');
  const document = captureModelDocument({
    id: 'audit-model',
    name: 'Current',
    snapshot: { graph: value },
    editions: [
      captureEdition({
        id: 'earlier',
        name: 'Earlier incompatible draft',
        snapshot: { graph: bad },
      }),
    ],
    origin: null,
  });
  const result = await invoke(['relationships', 'audit'], serializeModelDocument(document));
  const output = JSON.parse(result.text);
  expect(result.code).toBe(0);
  expect(output.scope).toBe('current-graph');
  expect(output.modelId).toBe('audit-model');
  expect(output.data.summary).toEqual({
    edges: 4,
    typed: 4,
    inferred: 0,
    unrelated: 0,
    blocked: 0,
  });
});
test('data-only rule files support named custom meaning and reject malformed, duplicate or executable configuration', async () => {
  const creatingDirectory = Effect.promise(() => mkdtemp(join(tmpdir(), 'zloz-audit-rules-')));
  const fixture = Effect.acquireUseRelease(
    creatingDirectory,
    (directory) =>
      Effect.promise(async () => {
        const graph = createEventStormingPattern(),
          first = graph.edges[0];
        assert(first, 'Missing edge');
        const text = serializeGraph({
          ...graph,
          edges: [
            {
              ...first,
              architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
            },
          ],
        });
        const file = join(directory, 'rules.json');
        const rule = {
          architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
          sources: ['actor'],
          targets: ['command'],
          label: 'Approves',
        };
        const rules = JSON.stringify({ version: 1, rules: [rule] });
        await writeFile(file, rules);
        expect((await invoke(['relationships', 'audit'], text)).code).toBe(1);
        const accepted = await invoke(['relationships', 'audit', '--rules', file], text);
        expect(accepted.code).toBe(0);
        expect(JSON.parse(accepted.text).data.entries[0].relationshipKey).toBe('custom:approves');
        expect(JSON.parse(accepted.text).conventions).toEqual({ source: 'file', input: file });
        expect(await readFile(file, 'utf8')).toBe(rules);
        for (const invalid of [
          { version: 2, rules: [rule] },
          { version: 1, rules: [rule, rule] },
          { version: 1, rules: [{ ...rule, sources: [] }] },
          { version: 1, rules: [{ ...rule, execute: 'throw new Error()' }] },
          { version: 1, rules: [rule], roleOf: '() => actor' },
        ]) {
          await writeFile(file, JSON.stringify(invalid));
          const result = await invoke(['relationships', 'audit', '--rules', file], text);
          expect(result.code).toBe(2);
          expect(JSON.parse(result.text).diagnostics[0].code).toBe('invalid-rules');
        }
        const reserved = await invoke(['relationships', 'audit', '--rules', '-'], text);
        expect(reserved.code).toBe(2);
        expect(JSON.parse(reserved.text).diagnostics[0].message).toContain('stdin is reserved');
        const missing = await invoke(
          ['relationships', 'audit', '--rules', join(directory, 'missing.json')],
          text,
        );
        expect(missing.code).toBe(2);
        expect(JSON.parse(missing.text).diagnostics[0].code).toBe('input-unavailable');
        await writeFile(
          file,
          JSON.stringify({
            version: 1,
            rules: [
              ...eventStormingRelationshipRules,
              { ...rule, architecture: { ...rule.architecture, name: 'a' } },
              { ...rule, architecture: { ...rule.architecture, name: 'b' } },
            ],
          }),
        );
        const { architecture: _architecture, ...untyped } = first;
        const ambiguous = await invoke(
          ['relationships', 'audit', '--rules', file],
          serializeGraph({ ...graph, edges: [untyped] }),
        );
        expect(ambiguous.code).toBe(1);
        expect(JSON.parse(ambiguous.text).data.entries[0].code).toBe('ambiguous-relationship');
      }),
    (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
  );
  await Effect.runPromise(fixture);
});
