import { expect, test } from 'bun:test';

import { NodeServices } from '@effect/platform-node';
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
