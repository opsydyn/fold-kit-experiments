// @vitest-environment node
import { createServer } from 'node:http';
import type { Socket } from 'node:net';

import { EventType } from '@ag-ui/core';
import { Cause, Effect, Exit, Fiber, Schema, Stream } from 'effect';
import { expect, it, onTestFinished, vi } from 'vitest';

import { startAgentTestServer } from '../../server/agent-analysis/http.test-helper';
import { THREAD_ID } from './contract';
import type { Message } from './message';
import { initModel } from './model';
import { agentStream, toRunInput } from './transport';
import { update } from './update';

const request = { runId: 'run-1', scenario: 'normal' } as const;
const collect = (endpoint: string) =>
  Effect.runPromise(Stream.runCollect(agentStream(request, { endpoint, fetch })));

// These HTTP fixtures deliberately exercise the SDK decoder, not a mocked observable.
async function wireServer(status: number, chunks: ReadonlyArray<Uint8Array>) {
  const sockets = new Set<Socket>();
  const server = createServer((_incoming, outgoing) => {
    outgoing.writeHead(status, { 'Content-Type': 'text/event-stream' });
    let cursor = 0;
    const write = () => {
      const chunk = chunks[cursor++];
      if (!chunk) outgoing.end();
      else {
        outgoing.write(chunk);
        setImmediate(write);
      }
    };
    write();
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Number }))(
    server.address(),
  );
  const endpoint = `http://127.0.0.1:${address.port}`;
  onTestFinished(async () => {
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    sockets.forEach((socket) => socket.destroy());
    await closed;
    server.removeAllListeners();
    await vi.waitFor(() => expect(sockets.size).toBe(0));
    await expect(fetch(endpoint)).rejects.toThrow();
  });
  return endpoint;
}

it('sends only the empty remote state and fixture scenario in RunAgentInput', () => {
  expect(toRunInput(request)).toEqual({
    threadId: 'agent-analysis',
    runId: 'run-1',
    state: { services: [] },
    messages: [],
    tools: [],
    context: [],
    forwardedProps: { scenario: 'normal' },
  });
});

it('collects a real normal HTTP run into Completed, four services and four accepted updates', async () => {
  const server = await startAgentTestServer();
  onTestFinished(() => server.close());
  const messages = await collect(server.url);
  const initial = update(initModel, { _tag: 'ClickedRun' }).model;
  const model = messages.reduce((model, message) => update(model, message).model, initial);
  expect(model.session).toEqual({ _tag: 'Completed', runId: 'run-1' });
  expect(model.wire?.services.map(({ id }) => id)).toEqual(['queue', 'search', 'api', 'events']);
  expect(model.accepted).toBe(4);
  expect(server.requests).toHaveLength(1);
  expect(server.requests[0]?.input).toEqual({ ...request, threadId: THREAD_ID });
  expect(server.requests[0]?.observations.filter(({ _tag }) => _tag === 'Disposed')).toEqual([
    { _tag: 'Disposed', cause: 'Completed' },
  ]);
  expect(messages.at(-1)).toMatchObject({ _tag: 'FailedStream', runId: request.runId });
}, 10000);

it('retains non-ASCII service names across fragmented UTF-8 SSE bytes', async () => {
  const events = [
    { type: EventType.RUN_STARTED, threadId: THREAD_ID, runId: request.runId },
    {
      type: EventType.STATE_SNAPSHOT,
      snapshot: {
        services: [
          { id: 'api', name: 'Caf\u00e9 \u6771\u4eac', series: 'Core', volume: 1, latency: 2 },
        ],
      },
    },
    { type: EventType.RUN_FINISHED, threadId: THREAD_ID, runId: request.runId },
  ];
  const bytes = new TextEncoder().encode(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
  );
  const endpoint = await wireServer(
    200,
    Array.from(bytes, (byte) => new Uint8Array([byte])),
  );
  const messages = await collect(endpoint);
  const initial = update(initModel, { _tag: 'ClickedRun' }).model;
  const model = messages.reduce((model, message) => update(model, message).model, initial);
  expect(model.session._tag).toBe('Completed');
  expect(model.wire?.services[0]?.name).toBe('Caf\u00e9 \u6771\u4eac');
});

it.each([503, 200])(
  'turns HTTP failure or premature closure into a captured-run failure: %s',
  async (status) => {
    const start = new TextEncoder().encode(
      `data: ${JSON.stringify({
        type: EventType.RUN_STARTED,
        threadId: THREAD_ID,
        runId: 'server-other-id',
      })}\n\n`,
    );
    const messages = await collect(await wireServer(status, status === 200 ? [start] : []));
    expect(messages.at(-1)).toMatchObject({
      _tag: 'FailedStream',
      runId: 'run-1',
      error: expect.any(String),
    });
    if (status === 200)
      expect(messages[0]).toMatchObject({ _tag: 'ReceivedAgentEvent', runId: 'run-1' });
  },
);

it('interrupts the collecting fiber, aborts real HTTP and disposes the producer once', async () => {
  const server = await startAgentTestServer();
  onTestFinished(() => server.close());
  const messages: Message[] = [];
  const fiber = Effect.runFork(
    Stream.runForEach(
      agentStream({ ...request, scenario: 'slow' }, { endpoint: server.url, fetch }),
      (message) =>
        Effect.sync(() => {
          messages.push(message);
        }),
    ),
  );
  onTestFinished(() => Effect.runPromise(Fiber.interrupt(fiber)));
  await vi.waitFor(() => expect(messages).toHaveLength(2));
  await Effect.runPromise(Fiber.interrupt(fiber));
  const exit = await Effect.runPromise(Fiber.await(fiber));
  expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
  await vi.waitFor(() =>
    expect(server.requests[0]?.observations.filter(({ _tag }) => _tag === 'Disposed')).toEqual([
      { _tag: 'Disposed', cause: 'Aborted' },
    ]),
  );
  const observed = [...(server.requests[0]?.observations ?? [])];
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(server.requests[0]?.observations).toEqual(observed);
  expect(messages).toHaveLength(2);
  expect(server.requests).toHaveLength(1);
});
