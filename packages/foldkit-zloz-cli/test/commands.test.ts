import { expect, test } from 'bun:test';

import { NodeServices } from '@effect/platform-node';
import { captureModelDocument, serializeModelDocument } from '@opsydyn/foldkit-zloz';
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
