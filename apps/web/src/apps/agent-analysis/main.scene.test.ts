// @vitest-environment node
import { EventType } from '@ag-ui/core';
import { BrowserHost, Html } from '@effect/ui/html';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { Effect, Exit, Scope } from 'effect';
import { afterAll, expect, it, onTestFinished, vi } from 'vitest';

import { initialWire } from '../../server/agent-analysis/fixtures';
import { startAgentTestServer } from '../../server/agent-analysis/http.test-helper';
import { THREAD_ID } from './contract';
import { Message } from './message';
import { activeRun, initModel, Model, Session } from './model';
import { subscriptionsFor } from './subscription';
import type { AgentTransportOptions } from './transport';
import { update } from './update';
import { view } from './view';

// DOM rendering is synthetic; HTTP, stream and abort ownership stay native.
const nativeIO = {
  fetch,
  Request,
  Response,
  Headers,
  AbortController,
  AbortSignal,
  ReadableStream,
  TextEncoder,
  TextDecoder,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
GlobalRegistrator.register();
Object.assign(globalThis, nativeIO);
afterAll(() => GlobalRegistrator.unregister());

async function scene(options: AgentTransportOptions, initial: Model = initModel) {
  const container = document.createElement('div');
  document.body.append(container);
  let latest = initial;
  const models: Model[] = [];
  const received: Message[] = [];
  const component = Html.component({ name: 'AgentFixture', model: Model, message: Message }).make({
    init: () => initial,
    update: ({ model }, message) => {
      received.push(message);
      latest = update(model, message).model;
      models.push(latest);
      return latest;
    },
    view,
    subscriptions: subscriptionsFor(options),
  });
  const scope = Scope.makeUnsafe();
  async function dispose() {
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
  onTestFinished(async () => {
    await dispose();
    container.remove();
  });
  const handle = await Effect.runPromise(
    Scope.provide(BrowserHost.mountEffect(component, {}, container, { head: false }), scope),
  );
  const navigate = (path: string) =>
    document.dispatchEvent(
      Object.assign(new Event('astro:before-swap'), { to: new URL(path, 'http://localhost') }),
    );
  return { dispose, navigate, model: () => latest, models, received, send: handle.send };
}

const finished = (runId: string) =>
  Message.ReceivedAgentEvent({
    runId,
    event: { type: EventType.RUN_FINISHED, threadId: THREAD_ID, runId },
  });

// Hold only delivery of native HTTP headers, so exit can race every pre-existing phase.
function holdHeaders() {
  const signals: AbortSignal[] = [];
  const heldFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    const signal = init?.signal;
    if (!signal) return response;
    signals.push(signal);
    await new Promise<void>((_resolve, reject) => {
      const abort = () => {
        signal.removeEventListener('abort', abort);
        reject(new Error('Aborted held response'));
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    return response;
  };
  return { fetch: heldFetch, signals };
}

it.each(['Connecting', 'AwaitingSnapshot', 'Streaming'] as const)(
  'Astro route exit in %s retains valid Wire, records RouteExit and aborts without replacement',
  async (phase) => {
    const server = await startAgentTestServer();
    onTestFinished(() => server.close());
    const held = holdHeaders();
    const request = { runId: 'run-1', scenario: 'slow' } as const;
    const session = Session[phase]({ request });
    const s = await scene(
      { endpoint: server.url, fetch: held.fetch },
      { ...initModel, session, generation: 1, wire: initialWire },
    );
    await vi.waitFor(() => expect(held.signals).toHaveLength(1));
    expect(s.model().session._tag).toBe(phase);
    s.navigate('/charts');
    await vi.waitFor(() =>
      expect(s.model().session).toEqual({ _tag: 'Cancelled', runId: 'run-1', cause: 'RouteExit' }),
    );
    await vi.waitFor(() => expect(held.signals[0]?.aborted).toBe(true));
    await vi.waitFor(() =>
      expect(server.requests[0]?.observations.filter(({ _tag }) => _tag === 'Disposed')).toEqual([
        { _tag: 'Disposed', cause: 'Aborted' },
      ]),
    );
    const cancelled = s.model();
    s.send(finished('run-1'));
    s.send(Message.FailedStream({ runId: 'run-1', error: 'late close' }));
    await vi.waitFor(() => expect(s.received.at(-1)?._tag).toBe('FailedStream'));
    expect(s.model()).toBe(cancelled);
    expect(s.model().wire).toBe(initialWire);
    expect(activeRun(s.model())).toBeNull();
    expect(server.requests).toHaveLength(1);
  },
);

it('preserves the same request through real phases, stayed navigation and local inspection changes', async () => {
  const server = await startAgentTestServer();
  onTestFinished(() => server.close());
  const s = await scene({ endpoint: server.url, fetch });
  s.send(Message.SelectedScenario({ scenario: 'slow' }));
  s.send(Message.ClickedRun());
  await vi.waitFor(() => expect(s.model().session._tag).toBe('Streaming'));
  const request = activeRun(s.model());
  expect(s.models.map(({ session }) => session._tag)).toContain('Connecting');
  expect(s.models.map(({ session }) => session._tag)).toContain('AwaitingSnapshot');
  for (const model of s.models.filter((model) => activeRun(model) !== null)) {
    expect(activeRun(model)).toBe(request);
  }
  expect(activeRun(s.model())).toBe(request);
  const wire = s.model().wire;
  const baseline = s.model().baseline;
  expect(baseline).toEqual(initialWire);
  s.send(Message.ChangedCompactView({ isCompact: true }));
  s.send(Message.SelectedScenario({ scenario: 'invalid' }));
  s.send(Message.ClickedFilter({ filter: 'Core' }));
  s.send(Message.ClickedService({ id: 'api' }));
  s.navigate('/agent-analysis/retained');
  s.navigate('/agent-analysis');
  await vi.waitFor(() =>
    expect(s.model()).toMatchObject({ scenario: 'invalid', filter: 'Core', selectedId: 'api' }),
  );
  expect(activeRun(s.model())).toBe(request);
  expect(s.model().wire).toBe(wire);
  expect(s.model().baseline).toBe(baseline);
  expect(s.model().isCompact).toBe(true);
  expect(server.requests).toHaveLength(1);
  s.send(Message.ClickedCancel());
  await vi.waitFor(() =>
    expect(s.model().session).toEqual({ _tag: 'Cancelled', runId: 'run-1', cause: 'User' }),
  );
  await vi.waitFor(() =>
    expect(server.requests[0]?.observations.filter(({ _tag }) => _tag === 'Disposed')).toEqual([
      { _tag: 'Disposed', cause: 'Aborted' },
    ]),
  );
  expect(server.requests).toHaveLength(1);
});

it('invalid fixture accepts the spike, rejects atomically and retains selection and baseline', async () => {
  const server = await startAgentTestServer();
  onTestFinished(() => server.close());
  const s = await scene({ endpoint: server.url, fetch }, { ...initModel, scenario: 'invalid' });
  s.send(Message.ClickedRun());
  await vi.waitFor(() => expect(s.model().session._tag).toBe('Streaming'));
  s.send(Message.ClickedService({ id: 'api' }));
  await vi.waitFor(() => expect(s.model().session._tag).toBe('Failed'), { timeout: 5000 });
  expect(s.model().accepted).toBe(2);
  expect(s.model().wire?.services.find(({ id }) => id === 'api')?.latency).toBe(145);
  expect(s.model().baseline?.services.find(({ id }) => id === 'api')?.latency).toBe(60);
  expect(s.model().selectedId).toBe('api');
  expect(s.model().rejection?.detail).toContain('999');
  expect(server.requests).toHaveLength(1);
}, 10000);

it('exit after real completion and queued closure/error facts cannot cancel or mutate Completed', async () => {
  const server = await startAgentTestServer();
  onTestFinished(() => server.close());
  const s = await scene({ endpoint: server.url, fetch });
  s.send(Message.ClickedRun());
  await vi.waitFor(() => expect(s.model().session._tag).toBe('Completed'), { timeout: 5000 });
  expect(s.model().accepted).toBe(4);
  const completed = s.model();
  s.navigate('/charts');
  s.send(Message.FailedStream({ runId: 'run-1', error: 'queued close' }));
  s.send(finished('run-1'));
  await vi.waitFor(() => expect(s.received.at(-1)).toEqual(finished('run-1')));
  expect(s.model()).toBe(completed);
  expect(server.requests).toHaveLength(1);
  expect(server.requests[0]?.observations.filter(({ _tag }) => _tag === 'Disposed')).toEqual([
    { _tag: 'Disposed', cause: 'Completed' },
  ]);
}, 10000);

it('replacement disposes the first connection and rejects its queued completion and failure', async () => {
  const server = await startAgentTestServer();
  onTestFinished(() => server.close());
  const s = await scene({ endpoint: server.url, fetch }, { ...initModel, scenario: 'slow' });
  s.send(Message.ClickedRun());
  await vi.waitFor(() => expect(s.model().session._tag).toBe('Streaming'));
  const wire = s.model().wire;
  s.send(Message.ClickedRun());
  await vi.waitFor(() => expect(server.requests).toHaveLength(2));
  const beforeLate = s.model();
  s.send(finished('run-1'));
  s.send(Message.FailedStream({ runId: 'run-1', error: 'late failure' }));
  await vi.waitFor(() => expect(s.received.at(-1)?._tag).toBe('FailedStream'));
  expect(s.model()).toBe(beforeLate);
  expect(s.model().wire).toBe(wire);
  expect(activeRun(s.model())?.runId).toBe('run-2');
  await vi.waitFor(() =>
    expect(server.requests[0]?.observations.filter(({ _tag }) => _tag === 'Disposed')).toEqual([
      { _tag: 'Disposed', cause: 'Aborted' },
    ]),
  );
  s.send(Message.ClickedCancel());
  await vi.waitFor(() =>
    expect(server.requests[1]?.observations.filter(({ _tag }) => _tag === 'Disposed')).toHaveLength(
      1,
    ),
  );
  expect(server.requests).toHaveLength(2);
});

it('runtime disposal closes the active HTTP request once and removes Astro navigation delivery', async () => {
  const server = await startAgentTestServer();
  onTestFinished(() => server.close());
  const s = await scene({ endpoint: server.url, fetch }, { ...initModel, scenario: 'slow' });
  s.send(Message.ClickedRun());
  await vi.waitFor(() => expect(s.model().session._tag).toBe('Streaming'));
  const before = s.model();
  await s.dispose();
  s.navigate('/charts');
  s.send(finished('run-1'));
  await vi.waitFor(() =>
    expect(server.requests[0]?.observations.filter(({ _tag }) => _tag === 'Disposed')).toEqual([
      { _tag: 'Disposed', cause: 'Aborted' },
    ]),
  );
  const received = [...s.received];
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(s.received).toEqual(received);
  expect(s.model()).toBe(before);
  expect(server.requests).toHaveLength(1);
});
