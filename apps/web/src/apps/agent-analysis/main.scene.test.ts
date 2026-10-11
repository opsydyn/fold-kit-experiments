// @vitest-environment node
import { EventType } from '@ag-ui/core';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { Port, Runtime, Subscription } from 'foldkit';
import { afterAll, expect, it, onTestFinished, vi } from 'vitest';

import { initialWire } from '../../server/agent-analysis/fixtures';
import { startAgentTestServer } from '../../server/agent-analysis/http.test-helper';
import { THREAD_ID } from './contract';
import { Message } from './message';
import { activeRun, initModel, Model, Session } from './model';
import { NavigationPort, toNavigationValue } from './navigation';
import { subscriptionsFor } from './subscription';
import type { AgentTransportOptions } from './transport';
import { update } from './update';

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

// A test-only inbound fact Port avoids depending on Task 4's UI or main module.
const FactPort = Port.inbound(Message);
async function scene(options: AgentTransportOptions, initial: Model = initModel) {
  const container = document.createElement('div');
  container.id = 'agent-analysis-scene';
  document.body.append(container);
  let latest = initial;
  const models: Model[] = [];
  const received: Message[] = [];
  const testFacts = Subscription.make<Model, Message>()(() => ({
    facts: Port.subscriptionEntry(FactPort, (message) => message),
  }));
  const handle = Runtime.embed(
    Runtime.makeElement({
      Model,
      init: () => ({ model: initial }),
      update: (model: Model, message: Message) => {
        received.push(message);
        const result = update(model, message);
        latest = result.model;
        models.push(latest);
        return result;
      },
      view: (_model, h) => h.div([], []),
      subscriptions: Subscription.aggregate(subscriptionsFor(options), testFacts),
      ports: { inbound: { navigation: NavigationPort, facts: FactPort } },
      container,
      devTools: false,
    }),
  );
  onTestFinished(() => {
    handle.dispose();
    container.remove();
  });
  // A boot-time Port fact is queued and confirms subscription readiness.
  handle.ports.navigation.send(
    toNavigationValue({ phase: 'coldLoad', path: '/agent-analysis', previousPath: null }),
  );
  await vi.waitFor(() => expect(received.some(({ _tag }) => _tag === 'Navigated')).toBe(true));
  return {
    handle,
    model: () => latest,
    models,
    received,
    send: (message: Message) => handle.ports.facts.send(message),
  };
}

const navigated = (phase: 'exited' | 'stayed' | 'entered') => ({
  phase,
  path: '/charts',
  previousPath: '/agent-analysis',
});
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
    if (!signal) throw new Error('Missing owned abort signal');
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
  'Port exit in %s retains valid Wire, records RouteExit and aborts without replacement',
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
    s.handle.ports.navigation.send(navigated('exited'));
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
  s.send(Message.SelectedScenario({ scenario: 'invalid' }));
  s.send(Message.ClickedFilter({ filter: 'Core' }));
  s.send(Message.ClickedService({ id: 'api' }));
  s.handle.ports.navigation.send(navigated('stayed'));
  s.handle.ports.navigation.send(navigated('entered'));
  await vi.waitFor(() =>
    expect(s.model()).toMatchObject({ scenario: 'invalid', filter: 'Core', selectedId: 'api' }),
  );
  expect(activeRun(s.model())).toBe(request);
  expect(s.model().wire).toBe(wire);
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

it('exit after real completion and queued closure/error facts cannot cancel or mutate Completed', async () => {
  const server = await startAgentTestServer();
  onTestFinished(() => server.close());
  const s = await scene({ endpoint: server.url, fetch });
  s.send(Message.ClickedRun());
  await vi.waitFor(() => expect(s.model().session._tag).toBe('Completed'), { timeout: 5000 });
  expect(s.model().accepted).toBe(4);
  const completed = s.model();
  s.handle.ports.navigation.send(navigated('exited'));
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

it('runtime disposal closes the active HTTP request once and removes Port delivery', async () => {
  const server = await startAgentTestServer();
  onTestFinished(() => server.close());
  const s = await scene({ endpoint: server.url, fetch }, { ...initModel, scenario: 'slow' });
  s.send(Message.ClickedRun());
  await vi.waitFor(() => expect(s.model().session._tag).toBe('Streaming'));
  const before = s.model();
  s.handle.dispose();
  s.handle.ports.navigation.send(navigated('exited'));
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
