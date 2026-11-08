import { expect, test } from 'bun:test';

import { NodeServices } from '@effect/platform-node';
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  PlatformError,
  Runtime,
  Sink,
  Stdio,
  Stream,
} from 'effect';

import { inputByteLimit, readGraph } from '../src/index';
import { writeResponse } from '../src/io';

const document = '{"version":1,"graph":{"nodes":[],"edges":[]}}';
const read = (stdin: Stream.Stream<Uint8Array>, terminal = false) =>
  readGraph('-').pipe(
    Effect.provide(Stdio.layerTest({ stdin, stdinIsTerminal: Effect.succeed(terminal) })),
    Effect.provide(NodeServices.layer),
  );
const errorOf = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;

test('UTF-8 byte boundaries survive arbitrary chunking; invalid bytes are rejected', async () => {
  const text =
    '{"version":1,"graph":{"nodes":[{"id":"支付","label":"🎶","position":{"x":0,"y":0},"size":{"width":200,"height":100},"ports":[]}],"edges":[]}}';
  const bytes = new TextEncoder().encode(text);
  const graph = await Effect.runPromise(
    read(Stream.fromIterable(Array.from(bytes, (byte) => Uint8Array.of(byte)))),
  );
  expect(graph.nodes[0]?.id).toBe('支付');
  expect(graph.nodes[0]?.label).toBe('🎶');
  const bad = await Effect.runPromiseExit(read(Stream.succeed(Uint8Array.of(0xc3))));
  expect(errorOf(bad)).toMatchObject({ _tag: 'CliInputError', code: 'invalid-utf8' });
});

test('the byte budget accepts its exact boundary and stops reading after overflow', async () => {
  const exact = new TextEncoder().encode(document.padEnd(inputByteLimit, ' '));
  expect((await Effect.runPromise(read(Stream.succeed(exact)))).nodes).toEqual([]);
  let readTail = false,
    finalized = false;
  const source = Stream.fromIterable([exact, Uint8Array.of(32)]).pipe(
    Stream.concat(
      Stream.fromEffect(
        Effect.sync(() => {
          readTail = true;
          return Uint8Array.of(32);
        }),
      ),
    ),
    Stream.ensuring(
      Effect.sync(() => {
        finalized = true;
      }),
    ),
  );
  const result = await Effect.runPromiseExit(read(source));
  expect(errorOf(result)).toMatchObject({ code: 'input-limit' });
  expect(readTail).toBe(false);
  expect(finalized).toBe(true);
});

test('interactive stdin is rejected without reading; invalid snapshot viewports use the core codec', async () => {
  let consumed = false;
  const tty = await Effect.runPromiseExit(
    read(
      Stream.fromEffect(
        Effect.sync(() => {
          consumed = true;
          return new Uint8Array();
        }),
      ),
      true,
    ),
  );
  expect(errorOf(tty)).toMatchObject({ code: 'input-required' });
  expect(consumed).toBe(false);
  const invalid = '{"version":1,"graph":{"nodes":[],"edges":[]},"viewport":{"x":0,"y":0,"zoom":0}}';
  expect(
    errorOf(await Effect.runPromiseExit(read(Stream.succeed(new TextEncoder().encode(invalid))))),
  ).toMatchObject({ code: 'invalid-document' });
});

test('interrupting a blocked input read finalizes the source scope', async () => {
  const released = await Effect.runPromise(
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const closed = yield* Deferred.make<void>();
      const input = Stream.fromEffect(Deferred.succeed(started, undefined)).pipe(
        Stream.flatMap(() => Stream.never),
        Stream.ensuring(Deferred.succeed(closed, undefined)),
      );
      const fiber = yield* read(input).pipe(Effect.forkChild);
      yield* Deferred.await(started);
      yield* Fiber.interrupt(fiber);
      return yield* Deferred.isDone(closed);
    }).pipe(Effect.timeout('2 seconds')),
  );
  expect(released).toBe(true);
});

test('an unavailable stdout fails through the typed I/O channel with exit 2', async () => {
  const output = Stdio.layerTest({
    stdout: () =>
      Sink.fail(
        PlatformError.badArgument({
          module: 'Stdio',
          method: 'stdout',
          description: 'Closed output',
        }),
      ),
  });
  const result = await Effect.runPromiseExit(
    writeResponse({
      protocol: 'foldkit-zloz-cli/v1',
      operation: 'validate',
      status: 'valid',
      summary: { nodes: 0, edges: 0 },
      diagnostics: [],
    }).pipe(Effect.provide(output)),
  );
  expect(errorOf(result)).toMatchObject({ _tag: 'CliOutputError' });
  expect(Runtime.getErrorExitCode(errorOf(result))).toBe(2);
});
