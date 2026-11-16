import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NodeServices } from '@effect/platform-node';
import {
  parseGraph,
  captureModelDocument,
  captureEdition,
  serializeModelDocument,
  createEventStormingPattern,
  serializeGraph,
  eventStormingRelationshipRules,
} from '@opsydyn/foldkit-zloz';
import { Cause, Effect, Exit, Runtime, Schema, Sink, Stdio, Stream } from 'effect';

import c4ReceiptWire from '../../foldkit-zloz/test/fixtures/c4-conversion-v1.json';
import dddExpected from '../../foldkit-zloz/test/fixtures/ddd-audit-report.json';
import dddWire from '../../foldkit-zloz/test/fixtures/ddd-audit-v1.json';
import dddReview from '../../foldkit-zloz/test/fixtures/ddd-review-model.json';
import modelV3Wire from '../../foldkit-zloz/test/fixtures/model-v3.json';
import workshopWire from '../../foldkit-zloz/test/fixtures/workshop-v1.json';
import { run, CliDiagnostic, inputByteLimit } from '../src/index';

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

test('review packets require explicit loss consent but creation succeeds even with introduced findings', async () => {
  const graph = createEventStormingPattern(),
    first = graph.edges[0];
  assert(first);
  const model = {
    id: 'review',
    name: 'Review',
    origin: null,
    snapshot: {
      graph: {
        ...graph,
        edges: [
          { ...first, architecture: { family: 'event-storming' as const, role: 'emits' as const } },
        ],
      },
    },
    editions: [{ id: 'before', name: 'Before', snapshot: { graph } }],
  };
  const text = serializeModelDocument(model);
  const strict = await invoke(['review', 'packet', '--baseline', 'before'], text);
  expect(strict.code).toBe(1);
  expect(JSON.parse(strict.text)).toMatchObject({ operation: 'review-packet', status: 'rejected' });
  expect(
    JSON.parse(strict.text).diagnostics.some(
      (item: { side: string; severity: string }) =>
        item.side === 'baseline' && item.severity === 'loss',
    ),
  ).toBe(true);
  const scopedDiagnostic = JSON.parse(strict.text).diagnostics.find(
    (item: { side?: string }) => item.side === 'baseline',
  );
  expect(Schema.decodeUnknownSync(CliDiagnostic)(scopedDiagnostic).side).toBe('baseline');
  const reported = await invoke(
    ['review', 'packet', '--baseline', 'before', '--loss-policy', 'report', '--direction', 'TB'],
    text,
  );
  expect(reported.code).toBe(0);
  const packet = JSON.parse(reported.text);
  expect(packet).toMatchObject({
    protocol: 'foldkit-zloz-cli/v1',
    operation: 'review-packet',
    status: 'created',
    scope: 'selected-snapshots',
  });
  expect(packet.data.format).toBe('foldkit-zloz-review');
  expect(packet.data.comparison.summary.introduced).toBe(1);
  expect(packet.data.projections.selected.source).toStartWith('flowchart TB\n');
  const same = await invoke(
    ['review', 'packet', '--baseline', 'before', '--edition', 'before', '--loss-policy', 'report'],
    text,
  );
  expect(same.code).toBe(0);
  expect(JSON.parse(same.text).data.selected.source.id).toBe('before');
  expect(JSON.parse(same.text).data.comparison.summary.introduced).toBe(0);
  for (const args of [
    ['--baseline', 'missing'],
    ['--baseline', 'before', '--edition', 'missing'],
  ]) {
    const result = await invoke(['review', 'packet', ...args, '--loss-policy', 'report'], text);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.text).diagnostics[0].subject).toBe('missing');
  }
  const noModel = await invoke(['review', 'packet', '--baseline', 'before'], empty);
  expect(noModel.code).toBe(2);
  expect(JSON.parse(noModel.text).diagnostics[0].code).toBe('model-required');
  const invalid = await invoke(['review', 'packet', '--baseline', 'before'], '{bad');
  expect(invalid.code).toBe(2);
  expect(JSON.parse(invalid.text).diagnostics[0].code).toBe('invalid-json');
  const noStdinRules = await invoke(
    ['review', 'packet', '--baseline', 'before', '--rules', '-'],
    text,
  );
  expect(noStdinRules.code).toBe(2);
  expect(JSON.parse(noStdinRules.text).diagnostics[0].code).toBe('invalid-rules');
  expect(serializeModelDocument(model)).toBe(text);
});

test('edition comparison gates on introduced findings and selects only explicit model editions', async () => {
  const graph = createEventStormingPattern(),
    first = graph.edges[0];
  assert(first);
  const bad = {
    ...graph,
    edges: [
      { ...first, architecture: { family: 'event-storming' as const, role: 'emits' as const } },
    ],
  };
  const model = {
    id: 'comparison',
    name: 'Comparison',
    snapshot: { graph: bad },
    origin: null,
    editions: [
      { id: 'clean', name: 'Clean', snapshot: { graph } },
      { id: 'bad', name: 'Bad', snapshot: { graph: bad } },
    ],
  };
  const input = serializeModelDocument(model);
  const regression = await invoke(['relationships', 'compare', '--baseline', 'clean'], input);
  expect(regression.code).toBe(1);
  const output = JSON.parse(regression.text);
  expect(output).toMatchObject({
    operation: 'relationships-compare',
    status: 'compared',
    scope: 'model-editions',
    conventions: { source: 'builtin', input: null },
  });
  expect(output.data.summary).toEqual({ introduced: 1, resolved: 0, persisting: 0 });
  expect(output.data.selected.source).toEqual({ kind: 'current' });
  expect(output.diagnostics).toEqual([
    {
      code: 'relationship-incompatible-roles',
      message: output.data.introduced[0].message,
      subject: first.id,
      severity: 'error',
      dimension: 'semantics',
    },
  ]);
  const persisting = await invoke(['relationships', 'compare', '--baseline', 'bad'], input);
  expect(persisting.code).toBe(0);
  expect(JSON.parse(persisting.text).data.summary).toEqual({
    introduced: 0,
    resolved: 0,
    persisting: 1,
  });
  expect(JSON.parse(persisting.text).diagnostics).toEqual([]);
  expect(JSON.parse(persisting.text).data.selected.audit.status).toBe('incompatible');
  const resolved = await invoke(
    ['relationships', 'compare', '--baseline', 'bad', '--edition', 'clean'],
    input,
  );
  expect(resolved.code).toBe(0);
  expect(JSON.parse(resolved.text).data.summary).toEqual({
    introduced: 0,
    resolved: 1,
    persisting: 0,
  });
  expect(JSON.parse(resolved.text).data.selected.source).toEqual({
    kind: 'edition',
    id: 'clean',
    name: 'Clean',
  });
  for (const [flags, code] of [
    [['--baseline', 'absent'], 'unknown-baseline'],
    [['--baseline', 'bad', '--edition', 'absent'], 'unknown-edition'],
  ] as const) {
    const result = await invoke(['relationships', 'compare', ...flags], input);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.text)).toMatchObject({
      operation: 'relationships-compare',
      status: 'rejected',
      diagnostics: [{ code, subject: 'absent' }],
    });
  }
  for (const input of [empty, serializeGraph(graph)]) {
    const result = await invoke(['relationships', 'compare', '--baseline', 'clean'], input);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.text).diagnostics[0].code).toBe('model-required');
  }
  const invalid = await invoke(['relationships', 'compare', '--baseline', 'clean'], '{bad');
  expect(invalid.code).toBe(2);
  expect(JSON.parse(invalid.text).diagnostics[0].code).toBe('invalid-json');
  expect(serializeModelDocument(model)).toBe(input);
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
        await writeFile(
          file,
          JSON.stringify({
            version: 1,
            rules: [{ ...rule, architecture: { family: 'ddd', scope: 'tactical', role: 'emits' } }],
          }),
        );
        const foreign = await invoke(['relationships', 'audit', '--rules', file], text);
        expect(foreign.code).toBe(2);
        expect(JSON.parse(foreign.text).diagnostics[0].code).toBe('invalid-rules');
        const rules = JSON.stringify({ version: 1, rules: [rule] });
        await writeFile(file, rules);
        expect((await invoke(['relationships', 'audit'], text)).code).toBe(1);
        const accepted = await invoke(['relationships', 'audit', '--rules', file], text);
        expect(accepted.code).toBe(0);
        expect(JSON.parse(accepted.text).data.entries[0].relationshipKey).toBe('custom:approves');
        expect(JSON.parse(accepted.text).conventions).toEqual({ source: 'file', input: file });
        expect(await readFile(file, 'utf8')).toBe(rules);
        const customModel = serializeModelDocument({
          id: 'custom',
          name: 'Custom',
          origin: null,
          snapshot: { graph: { ...graph, edges: [] } },
          editions: [
            {
              id: 'custom-baseline',
              name: 'Custom baseline',
              snapshot: {
                graph: {
                  ...graph,
                  edges: [
                    {
                      ...first,
                      architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
                    },
                  ],
                },
              },
            },
          ],
        });
        const baselineFinding = await invoke(
          ['relationships', 'compare', '--baseline', 'custom-baseline'],
          customModel,
        );
        expect(baselineFinding.code).toBe(0);
        expect(JSON.parse(baselineFinding.text).data.summary.resolved).toBe(1);
        const sharedRules = await invoke(
          ['relationships', 'compare', '--baseline', 'custom-baseline', '--rules', file],
          customModel,
        );
        expect(sharedRules.code).toBe(0);
        expect(JSON.parse(sharedRules.text).data.summary).toEqual({
          introduced: 0,
          resolved: 0,
          persisting: 0,
        });
        expect(JSON.parse(sharedRules.text).data.baseline.audit.summary.typed).toBe(1);
        const portable = await invoke(
          [
            'review',
            'packet',
            '--baseline',
            'custom-baseline',
            '--rules',
            file,
            '--loss-policy',
            'report',
          ],
          customModel,
        );
        expect(portable.code).toBe(0);
        expect(JSON.parse(portable.text).data.conventions.rules[0].label).toBe('Approves');
        expect(JSON.stringify(JSON.parse(portable.text).data)).not.toContain(file);
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
        const invalidComparisonRules = await invoke(
          ['relationships', 'compare', '--baseline', 'custom-baseline', '--rules', file],
          customModel,
        );
        expect(invalidComparisonRules.code).toBe(2);
        expect(JSON.parse(invalidComparisonRules.text)).toMatchObject({
          operation: 'relationships-compare',
          status: 'rejected',
          diagnostics: [{ code: 'invalid-rules' }],
        });
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

test('CLI validation accepts DDD wire meaning while its causal audit reports it as unrelated', async () => {
  const source = createEventStormingPattern(),
    first = source.edges[0];
  assert(first);
  const text = serializeGraph({
    nodes: source.nodes.map((node) => ({
      ...node,
      architecture: { family: 'ddd', role: 'entity' },
    })),
    edges: [{ ...first, architecture: { family: 'ddd', scope: 'tactical', role: 'references' } }],
  });
  expect((await invoke(['validate'], text)).code).toBe(0);
  const result = await invoke(['relationships', 'audit'], text);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.text).data.summary).toEqual({
    edges: 1,
    typed: 0,
    inferred: 0,
    unrelated: 1,
    blocked: 0,
  });
});

test('review validate and inspect reopen portable data without treating findings as invalid input', async () => {
  const text = await readFile(
    new URL('../../foldkit-zloz-mermaid/test/fixtures/review-packet-v1.json', import.meta.url),
    'utf8',
  );
  const checked = await invoke(['review', 'validate'], text);
  expect(checked.code).toBe(0);
  expect(JSON.parse(checked.text)).toMatchObject({
    operation: 'review-validate',
    status: 'valid',
    summary: {
      model: { id: 'orders' },
      audit: { status: 'regressed', summary: { introduced: 1 } },
    },
  });
  const opened = await invoke(['review', 'inspect'], text);
  expect(opened.code).toBe(0);
  expect(JSON.parse(opened.text)).toMatchObject({
    operation: 'review-inspect',
    status: 'inspected',
    data: { format: 'foldkit-zloz-review', scope: 'selected-snapshots' },
  });
  expect(JSON.parse(opened.text).data).toEqual(JSON.parse(text));
});
test('review input rejection reports decoder codes and JSON paths with exit 2', async () => {
  const text = await readFile(
    new URL('../../foldkit-zloz-mermaid/test/fixtures/review-packet-v1.json', import.meta.url),
    'utf8',
  );
  const forged = JSON.parse(text);
  forged.projections.selected.source += ' changed';
  const changed = await invoke(['review', 'inspect'], JSON.stringify(forged));
  expect(changed.code).toBe(2);
  expect(
    Schema.decodeUnknownSync(CliDiagnostic)(JSON.parse(changed.text).diagnostics[0]).path,
  ).toBe('/projections/selected/source');
  expect(JSON.parse(changed.text)).toMatchObject({
    operation: 'review-inspect',
    status: 'rejected',
    diagnostics: [
      { code: 'inconsistent-packet', path: '/projections/selected/source', subject: '-' },
    ],
  });
  for (const [input, code] of [
    ['{', 'invalid-json'],
    ['{"version":1,"version":1}', 'invalid-json'],
    ['['.repeat(65) + '0' + ']'.repeat(65), 'limit-exceeded'],
  ] as const) {
    const result = await invoke(['review', 'validate'], input);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.text).diagnostics[0].code).toBe(code);
  }
  const wrapper = await invoke(
    ['review', 'validate'],
    JSON.stringify({ protocol: 'foldkit-zloz-cli/v1', data: JSON.parse(text) }),
  );
  expect(wrapper.code).toBe(2);
  expect(JSON.parse(wrapper.text).diagnostics[0].code).toBe('unsupported-format');
});

test('review commands preserve packet files and report file/byte limits through the same JSON protocol', async () => {
  const packet = await readFile(
    new URL('../../foldkit-zloz-mermaid/test/fixtures/review-packet-v1.json', import.meta.url),
    'utf8',
  );
  const directory = await mkdtemp(join(tmpdir(), 'zloz-review-read-'));
  // Native file fixture cleanup must run even when an assertion fails.
  // oxlint-disable-next-line linteffect/no-try-catch
  try {
    const file = join(directory, 'review.json');
    await writeFile(file, packet);
    for (const command of ['validate', 'inspect']) {
      const result = await invoke(['review', command, '--input', file], '');
      expect(result.code).toBe(0);
      expect(result.text.endsWith('\n')).toBe(true);
      expect(await readFile(file, 'utf8')).toBe(packet);
    }
    const missing = await invoke(['review', 'inspect', '-i', join(directory, 'missing.json')], '');
    expect(missing.code).toBe(2);
    expect(JSON.parse(missing.text)).toMatchObject({
      operation: 'review-inspect',
      status: 'rejected',
      diagnostics: [{ code: 'input-unavailable' }],
    });
    const padding = inputByteLimit - new TextEncoder().encode(packet).byteLength;
    const boundary = packet + ' '.repeat(padding);
    const exact = await invoke(['review', 'validate'], boundary);
    expect(exact.code).toBe(0);
    const overflow = await invoke(['review', 'validate'], boundary + ' ');
    expect(overflow.code).toBe(2);
    expect(JSON.parse(overflow.text).diagnostics[0].code).toBe('input-limit');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('patch dry-run uses separately supplied source and reports loss, stale and decoder exit semantics', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zloz-patch-cli-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Native temporary-file fixture must be removed after command assertions.
  try {
    const literal = JSON.parse(
      await readFile(
        new URL('../../foldkit-zloz/test/fixtures/modelling-patch-v1.json', import.meta.url),
        'utf8',
      ),
    );
    const source = join(dir, 'source.json');
    const model = captureModelDocument({
      id: literal.source.modelId,
      name: 'Commerce',
      snapshot: { graph: literal.source.graph },
      editions: [],
      origin: null,
    });
    const original = serializeModelDocument(model);
    await writeFile(source, original);
    const args = [
      'patch',
      'dry-run',
      '--source',
      source,
      '--session',
      literal.source.sessionId,
      '--revision',
      '7',
    ];
    const valid = await invoke(args, JSON.stringify(literal));
    expect(valid.code).toBe(0);
    const body = JSON.parse(valid.text);
    expect(body.operation).toBe('patch-dry-run');
    expect(body.data.graph.nodes[0].label).toBe('Order management');
    expect(body.data.losses[0].fields).toEqual(['label']);
    const stale = await invoke([...args.slice(0, -1), '8'], JSON.stringify(literal));
    expect(stale.code).toBe(1);
    expect(JSON.parse(stale.text).data.type).toBe('rejected');
    const invalid = await invoke(args, '{"version":1,"version":1}');
    expect(invalid.code).toBe(2);
    expect(JSON.parse(invalid.text).diagnostics[0].code).toBe('invalid-json');
    const both = await invoke(
      ['patch', 'dry-run', '--source', '-', '--session', 's', '--revision', '0'],
      '{}',
    );
    expect(both.code).toBe(2);
    expect(await readFile(source, 'utf8')).toBe(original);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('DDD audit emits the exact core report and semantic diagnostics with exit 1', async () => {
  const input = JSON.stringify(dddWire),
    result = await invoke(['ddd', 'audit'], input);
  expect(result.code).toBe(1);
  expect(result.text.trim().split('\n')).toHaveLength(1);
  assert.deepStrictEqual(JSON.parse(result.text), {
    protocol: 'foldkit-zloz-cli/v1',
    operation: 'ddd-audit',
    status: 'audited',
    scope: 'current-graph',
    modelId: null,
    conventions: { source: 'builtin', input: null },
    data: dddExpected,
    diagnostics: dddExpected.entries
      .filter((entry) => entry.status === 'blocked')
      .map((entry) => ({
        code: `ddd-relationship-${entry.code}`,
        message: entry.message,
        subject: entry.edgeId,
        severity: 'error',
        dimension: 'semantics',
      })),
  });
  expect(input).toBe(JSON.stringify(dddWire));
});
test('DDD audit has compatible/no-coverage exits and graph/snapshot/model current-graph scope', async () => {
  const compatible = {
    ...dddWire,
    graph: {
      ...dddWire.graph,
      edges: dddWire.graph.edges.filter((edge) =>
        ['A-emits', 'b-strategic', 'c-side-absent', 'z-feeds'].includes(edge.id),
      ),
    },
  };
  const snapshot = { ...compatible, viewport: { x: 12, y: -20, zoom: 2 } };
  const model = serializeModelDocument(
    captureModelDocument({
      id: 'ddd-model',
      name: 'DDD',
      snapshot: { graph: parseGraph(JSON.stringify(compatible)) },
      editions: [
        {
          id: 'old',
          name: 'Incompatible baseline',
          snapshot: { graph: parseGraph(JSON.stringify(dddWire)) },
        },
      ],
      origin: null,
    }),
  );
  for (const text of [JSON.stringify(compatible), JSON.stringify(snapshot), model]) {
    const result = await invoke(['ddd', 'audit'], text),
      response = JSON.parse(result.text);
    expect(result.code).toBe(0);
    expect(response.data.summary).toEqual({ edges: 4, typed: 4, unrelated: 0, blocked: 0 });
    expect(response.scope).toBe('current-graph');
    expect(response.modelId).toBe(text === model ? 'ddd-model' : null);
    expect(response.diagnostics).toEqual([]);
  }
  const causal = await invoke(['relationships', 'audit'], JSON.stringify(compatible));
  expect(JSON.parse(causal.text).data.summary.unrelated).toBe(4);
  const unrelated = {
    ...dddWire,
    graph: {
      ...dddWire.graph,
      edges: dddWire.graph.edges.filter(
        (edge) => edge.id === 'á-untyped' || edge.id === 'i-causal',
      ),
    },
  };
  for (const text of [empty, JSON.stringify(unrelated)]) {
    const result = await invoke(['ddd', 'audit'], text);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.text).data.summary.typed).toBe(0);
  }
});
test('DDD rule files replace conventions, preserve files and reject invalid catalogues before model reading', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zloz-ddd-rules-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Native temporary fixtures must be reclaimed after all assertions.
  try {
    const file = join(directory, 'rules.json'),
      modelFile = join(directory, 'diagram.json');
    const source = {
      ...dddWire,
      graph: {
        ...dddWire.graph,
        edges: dddWire.graph.edges.filter((edge) => edge.id === 'e-custom'),
      },
    };
    const text = JSON.stringify(source);
    await writeFile(modelFile, text);
    const rule = {
      architecture: { family: 'ddd', scope: 'tactical', role: 'custom', name: 'enriches' },
      sources: ['aggregate-root'],
      targets: ['domain-event'],
      label: 'Enriches',
      direction: 'directed',
    };
    const rules = JSON.stringify({ version: 1, rules: [rule] });
    await writeFile(file, rules);
    const result = await invoke(['ddd', 'audit', '--input', modelFile, '--rules', file], '');
    expect(result.code).toBe(0);
    expect(JSON.parse(result.text)).toMatchObject({
      operation: 'ddd-audit',
      conventions: { source: 'file', input: file },
      data: { summary: { edges: 1, typed: 1, unrelated: 0, blocked: 0 } },
    });
    expect(await readFile(file, 'utf8')).toBe(rules);
    expect(await readFile(modelFile, 'utf8')).toBe(text);
    const bad = [
      { version: 2, rules: [rule] },
      { version: 1, rules: [rule], extra: true },
      { version: 1, rules: [{ ...rule, extra: true }] },
      {
        version: 1,
        rules: [{ ...rule, architecture: { family: 'event-storming', role: 'issues' } }],
      },
      { version: 1, rules: [{ ...rule, sources: ['actor'] }] },
      { version: 1, rules: [{ ...rule, sources: [] }] },
      { version: 1, rules: [{ ...rule, targets: ['bounded-context'] }] },
      { version: 1, rules: [rule, rule] },
      { version: 1, rules: [{ ...rule, direction: 'bidirectional' }] },
      {
        version: 1,
        rules: [
          { ...rule, architecture: { ...rule.architecture, upstream: ['open-host-service'] } },
        ],
      },
    ];
    for (const value of bad) {
      await writeFile(file, JSON.stringify(value));
      const rejected = await invoke(['ddd', 'audit', '--rules', file], '{not even a model');
      expect(rejected.code).toBe(2);
      expect(JSON.parse(rejected.text)).toMatchObject({
        operation: 'ddd-audit',
        status: 'rejected',
        diagnostics: [{ code: 'invalid-rules', subject: file }],
      });
      expect(JSON.parse(rejected.text).data).toBeUndefined();
    }
    await writeFile(file, '{invalid');
    expect(
      JSON.parse((await invoke(['ddd', 'audit', '--rules', file], empty)).text).diagnostics[0].code,
    ).toBe('invalid-json');
    await writeFile(file, ' '.repeat(inputByteLimit + 1));
    expect(
      JSON.parse((await invoke(['ddd', 'audit', '--rules', file], empty)).text).diagnostics[0].code,
    ).toBe('input-limit');
    expect(
      JSON.parse((await invoke(['ddd', 'audit', '--rules', '-'], empty)).text).diagnostics[0].code,
    ).toBe('invalid-rules');
    expect(await readFile(modelFile, 'utf8')).toBe(text);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('DDD invalid documents, unavailable files and input limits exit 2 without an audit', async () => {
  for (const [args, text, code] of [
    [['ddd', 'audit'], '{bad', 'invalid-json'],
    [['ddd', 'audit'], '{"version":2,"graph":{"nodes":[],"edges":[]}}', 'invalid-document'],
    [
      ['ddd', 'audit'],
      JSON.stringify({
        ...dddWire,
        graph: {
          ...dddWire.graph,
          edges: [
            {
              ...dddWire.graph.edges[0],
              architecture: { family: 'ddd', scope: 'strategic', role: 'feeds' },
            },
          ],
        },
      }),
      'invalid-document',
    ],
    [
      ['ddd', 'audit'],
      JSON.stringify({
        ...dddWire,
        graph: {
          ...dddWire.graph,
          edges: [{ ...dddWire.graph.edges[0], source: { node: 'read', port: 'in' } }],
        },
      }),
      'invalid-document',
    ],
    [['ddd', 'audit'], ' '.repeat(inputByteLimit + 1), 'input-limit'],
    [['ddd', 'audit', '--input', '/no-such-zloz-ddd-document'], '', 'input-unavailable'],
    [['ddd', 'audit', '--rules', '/no-such-zloz-ddd-rules'], empty, 'input-unavailable'],
  ] as const) {
    const result = await invoke(args, text),
      response = JSON.parse(result.text);
    expect(result.code).toBe(2);
    expect(response).toMatchObject({
      operation: 'ddd-audit',
      status: 'rejected',
      diagnostics: [{ code }],
    });
    expect(response.data).toBeUndefined();
  }
});

test('DDD comparison reports exact deltas with regression exits, explicit target and separate malformed/selector rejection', async () => {
  const input = JSON.stringify(dddReview);
  const result = await invoke(['ddd', 'compare', '--baseline', 'ddd-before'], input);
  expect(result.code).toBe(1);
  const output = JSON.parse(result.text);
  expect(output).toMatchObject({
    operation: 'ddd-compare',
    status: 'compared',
    scope: 'model-editions',
    conventions: { source: 'builtin', input: null },
  });
  expect(output.data.summary).toEqual({ introduced: 2, resolved: 3, persisting: 1 });
  expect(
    output.diagnostics.map((d: { subject: string; code: string }) => [d.subject, d.code]),
  ).toEqual([
    ['new', 'ddd-relationship-unknown-relationship'],
    ['recoded', 'ddd-relationship-unknown-relationship'],
  ]);
  expect(output.data.selected.source).toEqual({ kind: 'current' });
  const same = await invoke(
    ['ddd', 'compare', '--baseline', 'ddd-before', '--edition', 'ddd-before'],
    input,
  );
  expect(same.code).toBe(0);
  expect(JSON.parse(same.text).data.selected.audit.status).toBe('incompatible');
  expect(JSON.parse(same.text).data.summary).toEqual({ introduced: 0, resolved: 0, persisting: 4 });
  const archive = await invoke(
    ['ddd', 'compare', '--baseline', 'ddd-before', '--edition', 'ddd-after'],
    input,
  );
  expect(archive.code).toBe(1);
  expect(JSON.parse(archive.text).data.selected.source.id).toBe('ddd-after');
  for (const [args, document, code] of [
    [['--baseline', 'missing'], input, 'unknown-baseline'],
    [['--baseline', 'ddd-before', '--edition', 'missing'], input, 'unknown-edition'],
    [['--baseline', 'ddd-before'], empty, 'model-required'],
    [['--baseline', 'ddd-before'], '{bad', 'invalid-json'],
    [['--baseline', 'ddd-before', '--rules', '-'], input, 'invalid-rules'],
  ] as const) {
    const rejected = await invoke(['ddd', 'compare', ...args], document);
    expect(rejected.code).toBe(2);
    expect(JSON.parse(rejected.text)).toMatchObject({
      operation: 'ddd-compare',
      status: 'rejected',
      diagnostics: [{ code }],
    });
    expect(JSON.parse(rejected.text).data).toBeUndefined();
  }
});

test('workshop codecs and external-system rule files have explicit opt-in while annotation and frame roles reject as causal participants', async () => {
  const input = JSON.stringify(workshopWire);
  expect((await invoke(['validate'], input)).code).toBe(0);
  const legacy = await invoke(['relationships', 'audit'], input);
  expect(legacy.code).toBe(1);
  expect(JSON.parse(legacy.text).data.summary.blocked).toBe(3);
  const directory = await mkdtemp(join(tmpdir(), 'zloz-workshop-rules-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Local fixture must remove only its owned temporary rule file.
  try {
    const file = join(directory, 'rules.json');
    const value = {
      version: 1,
      rules: [
        {
          architecture: { family: 'event-storming', role: 'issues' },
          sources: ['external-system'],
          targets: ['command'],
          label: 'Issues',
        },
      ],
    };
    const text = JSON.stringify(value);
    await writeFile(file, text);
    const one = JSON.stringify({
      ...workshopWire,
      graph: {
        ...workshopWire.graph,
        edges: workshopWire.graph.edges.filter((e) => e.id === 'system-issues'),
      },
    });
    const allowed = await invoke(['relationships', 'audit', '--rules', file], one);
    expect(allowed.code).toBe(0);
    expect(JSON.parse(allowed.text).data.summary).toEqual({
      edges: 1,
      typed: 1,
      inferred: 0,
      unrelated: 0,
      blocked: 0,
    });
    expect(await readFile(file, 'utf8')).toBe(text);
    for (const role of ['hotspot', 'lane']) {
      await writeFile(
        file,
        JSON.stringify({ ...value, rules: [{ ...value.rules[0], sources: [role] }] }),
      );
      const rejected = await invoke(['relationships', 'audit', '--rules', file], one);
      expect(rejected.code).toBe(2);
      expect(JSON.parse(rejected.text)).toMatchObject({
        status: 'rejected',
        diagnostics: [{ code: 'invalid-rules' }],
      });
    }
    const invalid = JSON.stringify({
      ...workshopWire,
      graph: {
        ...workshopWire.graph,
        nodes: workshopWire.graph.nodes.map((n) =>
          n.id === 'hotspot'
            ? { ...n, architecture: { family: 'event-storming', role: 'hotspot' } }
            : n,
        ),
      },
    });
    const rejected = await invoke(['validate'], invalid);
    expect(rejected.code).toBe(2);
    expect(JSON.parse(rejected.text).status).toBe('rejected');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('C4 receipt inspection reports complete provenance, before/after changes and recorded losses as read-only JSON', async () => {
  const text = JSON.stringify(c4ReceiptWire);
  const result = await invoke(['c4', 'receipt', 'inspect'], text);
  expect(result.code).toBe(0);
  expect(result.text.trim().split('\n')).toHaveLength(1);
  const response = JSON.parse(result.text);
  expect(response.operation).toBe('c4-receipt-inspect');
  expect(response.status).toBe('inspected');
  expect(response.scope).toBe('recorded-conversion');
  expect(response.data.provenance).toEqual(c4ReceiptWire.source);
  expect(response.data.target).toEqual(c4ReceiptWire.document);
  expect(response.data.choices).toEqual(c4ReceiptWire.options);
  expect(response.data.authority).toBe('read-only-evidence');
  expect(response.data.lossesAccepted).toBe(true);
  expect(response.data.changes.nodes.map((n: { id: string }) => n.id)).toEqual(['event', 'system']);
  expect(response.data.changes.edges[0]).toMatchObject({
    id: 'emits',
    kind: 'changed',
    before: { label: 'Emits' },
    after: { label: 'Reports' },
  });
  expect(response.data.losses.map((f: { code: string }) => f.code)).toContain(
    'parent-constraints-removed',
  );
  expect(response.diagnostics.every((d: { severity: string }) => d.severity === 'loss')).toBe(true);
  expect(response.diagnostics.length).toBeGreaterThan(0);
  expect(JSON.stringify(c4ReceiptWire)).toBe(text);
});
test('C4 unsupported format/version exits 1 while invalid data and malformed invocation exit 2', async () => {
  for (const wire of [
    { ...c4ReceiptWire, version: 99 },
    { ...c4ReceiptWire, format: 'foldkit-zloz-ddd-conversion' },
    { format: 'foldkit-zloz-c4-conversion', version: 99, uninterpretable: null },
  ]) {
    const result = await invoke(['c4', 'receipt', 'inspect'], JSON.stringify(wire));
    expect(result.code).toBe(1);
    expect(JSON.parse(result.text)).toMatchObject({
      operation: 'c4-receipt-inspect',
      status: 'rejected',
    });
    expect(JSON.parse(result.text).diagnostics[0].code).toBe('incompatible-c4-receipt');
    expect(JSON.parse(result.text).data).toBeUndefined();
  }
  for (const text of [
    '{',
    'null',
    '{}',
    JSON.stringify({ ...c4ReceiptWire, lossesAccepted: false }),
    JSON.stringify({ ...c4ReceiptWire, version: '1' }),
    JSON.stringify({ ...c4ReceiptWire, format: 14 }),
    JSON.stringify({ ...c4ReceiptWire, extra: true }),
    JSON.stringify({
      ...c4ReceiptWire,
      document: { ...c4ReceiptWire.document, name: 'Forged target' },
    }),
  ]) {
    const result = await invoke(['c4', 'receipt', 'inspect'], text);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.text).status).toBe('rejected');
    expect(JSON.parse(result.text).data).toBeUndefined();
  }
  expect(
    (await invoke(['c4', 'receipt', 'inspect', '--apply'], JSON.stringify(c4ReceiptWire))).code,
  ).toBe(2);
});
test('C4 file inspection preserves bytes and reports missing/oversized input with exit 2', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zloz-c4-inspect-'));
  // oxlint-disable-next-line linteffect/no-try-catch -- Native fixture cleanup must run on failure.
  try {
    const input = join(directory, 'receipt.json');
    const text = JSON.stringify(c4ReceiptWire);
    await writeFile(input, text);
    const result = await invoke(['c4', 'receipt', 'inspect', '--input', input], '');
    expect(result.code).toBe(0);
    expect(await readFile(input, 'utf8')).toBe(text);
    const missing = await invoke(
      ['c4', 'receipt', 'inspect', '--input', join(directory, 'missing')],
      '',
    );
    expect(missing.code).toBe(2);
    expect(JSON.parse(missing.text).diagnostics[0].code).toBe('input-unavailable');
    const large = await invoke(['c4', 'receipt', 'inspect'], 'x'.repeat(inputByteLimit + 1));
    expect(large.code).toBe(2);
    expect(JSON.parse(large.text).diagnostics[0].code).toBe('input-limit');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('v2 validation, compatibility, Mermaid and native audits retain mode with explicit selector failures', async () => {
  const nodes = ['a', 'b'].map((id) => ({
    id,
    label: id,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    ports: [{ id: 'p', kind: 'input', side: 'left', offset: 0.5 }],
  }));
  const snapshot = {
    version: 2,
    connectionMode: 'loose',
    graph: {
      nodes,
      edges: [{ id: 'e', source: { node: 'a', port: 'p' }, target: { node: 'b', port: 'p' } }],
    },
  };
  const wire = JSON.stringify({
    format: 'foldkit-zloz-model',
    version: 2,
    document: { id: 'm', name: 'M', snapshot, editions: [], origin: null },
  });
  const valid = await invoke(['validate'], wire);
  expect(valid.code).toBe(0);
  expect(JSON.parse(valid.text).connectionMode).toBe('loose');
  expect(JSON.parse(valid.text).model.id).toBe('m');
  const inspected = await invoke(['compatibility', 'inspect'], wire);
  expect(inspected.code).toBe(0);
  expect(JSON.parse(inspected.text).data.downgrade.type).toBe('blocked');
  const projected = await invoke(['mermaid', 'export', '--loss-policy', 'report'], wire);
  expect(projected.code).toBe(0);
  expect(JSON.parse(projected.text).data.connectionMode).toBe('loose');
  expect(JSON.parse(projected.text).data.protocol).toBe('foldkit-zloz-mermaid/v2');
  const rejected = await invoke(['mermaid', 'export'], wire);
  expect(rejected.code).toBe(1);
  for (const args of [
    ['ddd', 'audit'],
    ['relationships', 'audit'],
  ]) {
    const audited = await invoke(args, wire);
    expect(audited.code).toBe(0);
    expect(JSON.parse(audited.text).connectionMode).toBe('loose');
  }
  for (const args of [
    ['ddd', 'compare', '--baseline', 'base'],
    ['relationships', 'compare', '--baseline', 'base'],
    ['review', 'packet', '--baseline', 'base'],
  ]) {
    const missing = await invoke(args, wire);
    expect(missing.code).toBe(2);
    expect(JSON.parse(missing.text).diagnostics[0].code).toBe('unknown-baseline');
  }
  expect((await invoke(['validate'], JSON.stringify(snapshot))).code).toBe(0);
  expect(
    (
      await invoke(
        ['validate'],
        wire.replace('"connectionMode":"loose"', '"connectionMode":"strict"'),
      )
    ).code,
  ).toBe(2);
});

test('native patch dry run reads v2 sources and distinguishes malformed proposals from malformed source data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zloz-v2-patch-gate-'));
  // oxlint-disable-next-line linteffect/no-try-catch
  try {
    const source = join(directory, 'source.json');
    const text = await readFile(
      new URL('../../foldkit-zloz/test/fixtures/model-v2-modes.json', import.meta.url),
      'utf8',
    );
    await writeFile(source, text);
    const result = await invoke(
      ['patch', 'dry-run', '--source', source, '--session', 'session', '--revision', '0'],
      '{invalid proposal never read',
    );
    expect(result.code).toBe(2);
    expect(JSON.parse(result.text).diagnostics[0].code).toBe('invalid-json');
    expect(await readFile(source, 'utf8')).toBe(text);
    await writeFile(source, '{invalid source');
    const malformed = await invoke(
      ['patch', 'dry-run', '--source', source, '--session', 'session', '--revision', '0'],
      '{}',
    );
    expect(malformed.code).toBe(2);
    expect(JSON.parse(malformed.text).diagnostics[0].code).toBe('invalid-json');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('native v2 packet creation, comparison and versioned patch dry run retain checkpoint modes', async () => {
  const modelText = await readFile(
    new URL('../../foldkit-zloz/test/fixtures/model-native-v2.json', import.meta.url),
    'utf8',
  );
  const packet = await invoke(
    ['review', 'packet', '--baseline', 'base', '--loss-policy', 'report'],
    modelText,
  );
  expect(packet.code).toBe(0);
  const data = JSON.parse(packet.text).data;
  expect(data.version).toBe(2);
  expect(data.baseline.snapshot.connectionMode).toBe('strict');
  expect(data.selected.snapshot.connectionMode).toBe('loose');
  const inspected = await invoke(['review', 'inspect'], JSON.stringify(data));
  expect(inspected.code).toBe(0);
  expect(JSON.parse(inspected.text).data).toEqual(data);
  const compared = await invoke(['relationships', 'compare', '--baseline', 'base'], modelText);
  expect(compared.code).toBe(1);
  expect(JSON.parse(compared.text).data.selected.connectionMode).toBe('loose');
  expect(JSON.parse(compared.text).data.introduced[0].code).toBe('incompatible-roles');
  const directory = await mkdtemp(join(tmpdir(), 'zloz-native-patch-'));
  // oxlint-disable-next-line linteffect/no-try-catch
  try {
    const source = join(directory, 'source.json');
    await writeFile(source, modelText);
    const text = await readFile(
      new URL('../../foldkit-zloz/test/fixtures/modelling-patch-v2.json', import.meta.url),
      'utf8',
    );
    const args = [
      'patch',
      'dry-run',
      '--source',
      source,
      '--session',
      'native-v2-fixture',
      '--revision',
      '0',
    ];
    const reviewed = await invoke(args, text);
    expect(reviewed.code).toBe(0);
    expect(JSON.parse(reviewed.text).data.patch.source.connectionMode).toBe('loose');
    expect(JSON.parse(reviewed.text).data.graph.edges[0].source.port).toBe('shared');
    const mismatched = JSON.parse(text);
    mismatched.source.connectionMode = 'strict';
    expect((await invoke(args, JSON.stringify(mismatched))).code).toBe(2);
    expect(await readFile(source, 'utf8')).toBe(modelText);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('native receipt inspectors distinguish immutable evidence, unsupported versions and invalid records', async () => {
  for (const [family, file] of [
    ['c4', 'c4-conversion-v2'],
    ['ddd', 'ddd-conversion-v2'],
    ['patch', 'modelling-patch-receipt-v2'],
  ] as const) {
    const text = await readFile(
      new URL(`../../foldkit-zloz/test/fixtures/${file}.json`, import.meta.url),
      'utf8',
    );
    const result = await invoke([family, 'receipt', 'inspect'], text);
    expect(result.code).toBe(0);
    const data = JSON.parse(result.text).data;
    expect(data.authority).toBe('read-only-evidence');
    if (family !== 'c4') {
      expect(data.review.kind).toBe(family);
      expect(data.review.losses.length).toBeGreaterThan(0);
    }
    expect(family === 'c4' ? data.target.snapshot.connectionMode : data.receipt.version).toBe(
      family === 'c4' ? 'loose' : 2,
    );
    const bad = JSON.parse(text);
    bad.version = 99;
    expect((await invoke([family, 'receipt', 'inspect'], JSON.stringify(bad))).code).toBe(1);
    const forged = JSON.parse(text);
    if (family === 'patch') forged.reviewed = false;
    else forged.lossesAccepted = false;
    expect((await invoke([family, 'receipt', 'inspect'], JSON.stringify(forged))).code).toBe(2);
    expect(
      (
        await invoke(
          [family, 'receipt', 'inspect'],
          text.replace('"version": 2', '"version": 2,"version": 2'),
        )
      ).code,
    ).toBe(2);
  }
  const deep =
    '{"format":"foldkit-zloz-patch-receipt","version":2,"extra":' +
    '['.repeat(500) +
    '0' +
    ']'.repeat(500) +
    '}';
  expect((await invoke(['patch', 'receipt', 'inspect'], deep)).code).toBe(2);
});

test('native CLI packet creation enforces its own UTF-8 reopening limit before reporting success', async () => {
  const graph = {
    nodes: [
      {
        id: 'a',
        label: 'A',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'p', kind: 'input', side: 'left', offset: 0.5 }],
        data: { large: 'x'.repeat(940_000) },
      },
    ],
    edges: Array.from({ length: 300 }, (_, i) => ({
      id: 'e' + i,
      source: { node: 'a', port: 'p' },
      target: { node: 'a', port: 'p' },
    })),
  };
  const text = JSON.stringify({
    format: 'foldkit-zloz-model',
    version: 2,
    document: {
      id: 'large',
      name: 'Large',
      origin: null,
      snapshot: { version: 2, connectionMode: 'loose', graph },
      editions: [
        {
          id: 'base',
          name: 'Base',
          snapshot: { version: 2, connectionMode: 'strict', graph: { nodes: [], edges: [] } },
        },
      ],
    },
  });
  expect(new TextEncoder().encode(text).byteLength).toBeLessThan(inputByteLimit);
  const result = await invoke(
    ['review', 'packet', '--baseline', 'base', '--loss-policy', 'report'],
    text,
  );
  expect(result.code).toBe(1);
  expect(JSON.parse(result.text).diagnostics[0].code).toBe('packet-limit');
});

test('explicit v3 compatibility inspector retains all checkpoint capabilities and lists unsupported adapters without conversion', async () => {
  const valid = await invoke(['compatibility', 'inspect-v3'], JSON.stringify(modelV3Wire));
  expect(valid.code).toBe(0);
  const report = JSON.parse(valid.text);
  expect(report.operation).toBe('compatibility-inspect');
  expect(report.data.version).toBe(3);
  expect(report.data.downgrade.type).toBe('blocked');
  expect(report.data.adapters.find((a: { adapter: string }) => a.adapter === 'svg').status).toBe(
    'supported',
  );
  expect(report.data.adapters.find((a: { adapter: string }) => a.adapter === 'png').status).toBe(
    'supported',
  );
  expect(
    report.data.adapters.find((a: { adapter: string }) => a.adapter === 'clipboard').status,
  ).toBe('supported');
  expect(
    report.data.adapters.find((a: { adapter: string }) => a.adapter === 'mermaid').status,
  ).toBe('supported');
  expect((await invoke(['compatibility', 'inspect-v3'], '{"version":3,"version":3}')).code).toBe(2);
  expect((await invoke(['compatibility', 'inspect-v3'], empty)).code).toBe(2);
});

test('native v3 CLI validates and audits the full capability document and recomputes read-only packets', async () => {
  const text = JSON.stringify(modelV3Wire);
  const valid = await invoke(['validate'], text);
  expect(valid.code).toBe(0);
  expect(JSON.parse(valid.text).documentVersion).toBe(3);
  for (const command of [
    ['ddd', 'audit'],
    ['relationships', 'audit'],
  ]) {
    const result = await invoke(command, text);
    expect([0, 1]).toContain(result.code);
    expect(JSON.parse(result.text).documentVersion).toBe(3);
  }
  const baseline = modelV3Wire.document.editions[0]!.id;
  for (const command of [
    ['ddd', 'compare'],
    ['relationships', 'compare'],
  ]) {
    const result = await invoke([...command, '--baseline', baseline], text);
    expect([0, 1]).toContain(result.code);
    expect(JSON.parse(result.text).data.baseline.capabilities).toBeDefined();
  }
  const created = await invoke(
    ['review', 'packet', '--baseline', baseline, '--loss-policy', 'report'],
    text,
  );
  expect(created.code).toBe(0);
  const packet = JSON.parse(created.text).data;
  expect(packet.version).toBe(3);
  const inspected = await invoke(['review', 'inspect'], JSON.stringify(packet));
  expect(inspected.code).toBe(0);
  expect(JSON.parse(inspected.text).data.baseline.snapshot.capabilities).toBeDefined();
  const changed = {
    ...packet,
    projections: {
      ...packet.projections,
      selected: { ...packet.projections.selected, source: 'flowchart LR\n' },
    },
  };
  expect((await invoke(['review', 'inspect'], JSON.stringify(changed))).code).toBe(2);
});
