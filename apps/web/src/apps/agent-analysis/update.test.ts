import { EventType } from '@ag-ui/core';
import { describe, expect, it } from 'vitest';

import { THREAD_ID, type Wire } from './contract';
import { Message } from './message';
import { activeRun, initModel, Model, Session, visibleServices } from './model';
import { update } from './update';

const wire: Wire = {
  services: [
    { id: 'api', name: 'Shared', series: 'Core', volume: 100, latency: 20 },
    { id: 'worker', name: 'Shared', series: 'Platform', volume: 50, latency: 40 },
  ],
};
const received = (
  model: Model,
  event: Extract<Message, { _tag: 'ReceivedAgentEvent' }>['event'],
  runId = 'run-1',
) => update(model, Message.ReceivedAgentEvent({ runId, event })).model;
const start = () => update(initModel, Message.ClickedRun()).model;
const awaiting = () =>
  received(start(), { type: EventType.RUN_STARTED, threadId: THREAD_ID, runId: 'run-1' });
const streaming = () => received(awaiting(), { type: EventType.STATE_SNAPSHOT, snapshot: wire });
const delta = (model: Model, patch: readonly object[]) =>
  received(model, { type: EventType.STATE_DELTA, delta: patch });
const finish = { type: EventType.RUN_FINISHED, threadId: THREAD_ID, runId: 'run-1' };

describe('pure run state machine', () => {
  it('creates deterministic descriptors and preserves their identity across active states', () => {
    const connecting = start();
    const request = activeRun(connecting);
    expect(request).toEqual({ runId: 'run-1', scenario: 'normal' });
    expect(connecting.session._tag).toBe('Connecting');
    const started = received(connecting, {
      type: EventType.RUN_STARTED,
      threadId: THREAD_ID,
      runId: 'run-1',
    });
    expect(started.session._tag).toBe('AwaitingSnapshot');
    expect(activeRun(started)).toBe(request);
    const loaded = received(started, { type: EventType.STATE_SNAPSHOT, snapshot: wire });
    expect(loaded.session._tag).toBe('Streaming');
    expect(activeRun(loaded)).toBe(request);
    expect(loaded.accepted).toBe(1);
  });

  it('does not reuse retained data as a new run snapshot baseline', () => {
    const old = {
      ...initModel,
      generation: 1,
      wire: { services: [] },
      session: Session.Completed({ runId: 'run-1' }),
    };
    const next = update(old, Message.ClickedRun()).model;
    const started = update(
      next,
      Message.ReceivedAgentEvent({
        runId: 'run-2',
        event: { type: EventType.RUN_STARTED, threadId: THREAD_ID, runId: 'run-2' },
      }),
    ).model;
    const failed = update(
      started,
      Message.ReceivedAgentEvent({
        runId: 'run-2',
        event: { type: EventType.STATE_DELTA, delta: [] },
      }),
    ).model;
    expect(failed.session._tag).toBe('Failed');
    expect(failed.wire).toBe(old.wire);
    expect(activeRun(failed)).toBeNull();
  });

  it('owns immutable snapshots and deltas without mutating event payloads', () => {
    const snapshot = { services: wire.services.map((service) => ({ ...service })) };
    const loaded = received(awaiting(), { type: EventType.STATE_SNAPSHOT, snapshot });
    for (const service of snapshot.services.slice(0, 1)) service.volume = 999;
    expect(loaded.wire?.services[0]?.volume).toBe(100);
    const value = { id: 'new', name: 'New', series: 'Core', volume: 1, latency: 2 };
    const changed = delta(loaded, [
      { op: 'add', path: '/services/-', value },
      { op: 'replace', path: '/services/0/volume', value: 200 },
    ]);
    value.volume = 999;
    expect(changed.wire?.services[2]?.volume).toBe(1);
    expect(loaded.wire?.services[0]?.volume).toBe(100);
    expect(changed.accepted).toBe(2);
  });

  it('supports JSON Patch test, copy and move atomically', () => {
    const loaded = streaming();
    const changed = delta(loaded, [
      { op: 'test', path: '/services/0/id', value: 'api' },
      { op: 'copy', from: '/services/0', path: '/services/-' },
      { op: 'replace', path: '/services/2/id', value: 'copy' },
      { op: 'move', from: '/services/1', path: '/services/0' },
    ]);
    expect(changed.wire?.services.map(({ id }) => id)).toEqual(['worker', 'api', 'copy']);
    expect(loaded.wire?.services.map(({ id }) => id)).toEqual(['api', 'worker']);
  });

  it.each(
    [
      [
        { op: 'replace', path: '/services/0/volume', value: 2 },
        { op: 'remove', path: '/services/99' },
      ],
      [
        { op: 'replace', path: '/services/0/volume', value: 2 },
        { op: 'test', path: '/services/0/id', value: 'wrong' },
      ],
      [{ op: 'replace', path: '/services/1/id', value: 'api' }],
      [{ op: 'replace', path: '/services/0/latency', value: -1 }],
      [{ op: 'add', path: '/__proto__/polluted', value: true }],
      [{ op: 'copy', from: '/constructor/prototype', path: '/services/-' }],
    ].map((patch) => ({ patch })),
  )('rolls back every operation on patch failure: %j', ({ patch }) => {
    const loaded = streaming();
    const failed = delta(loaded, patch);
    expect(failed.session._tag).toBe('Failed');
    expect(failed.wire).toBe(loaded.wire);
    expect(failed.accepted).toBe(1);
    expect(activeRun(failed)).toBeNull();
  });

  it.each([
    { type: EventType.RUN_STARTED, threadId: 'wrong', runId: 'run-1' },
    { type: EventType.RUN_STARTED, threadId: THREAD_ID, runId: 'wrong' },
    { type: EventType.STATE_SNAPSHOT, snapshot: wire },
    { type: EventType.STATE_DELTA, delta: [] },
    finish,
    { type: EventType.RUN_STARTED },
    { type: 'NOT_AN_EVENT' },
  ])('fails the active run for invalid envelope, identity or initial order: %j', (event) => {
    const failed = received(start(), event);
    expect(failed.session).toMatchObject({
      _tag: 'Failed',
      runId: 'run-1',
      failure: { _tag: 'Protocol' },
    });
    expect(activeRun(failed)).toBeNull();
  });

  it('rejects a duplicate start and completion before a snapshot', () => {
    expect(
      received(awaiting(), { type: EventType.RUN_STARTED, threadId: THREAD_ID, runId: 'run-1' })
        .session._tag,
    ).toBe('Failed');
    expect(received(awaiting(), finish).session._tag).toBe('Failed');
  });

  it.each([
    { services: [wire.services[0], wire.services[0]] },
    { services: [{ ...wire.services[0], volume: Infinity }] },
  ])('retains valid data on invalid snapshots: %j', (snapshot) => {
    const loaded = streaming();
    const failed = received(loaded, { type: EventType.STATE_SNAPSHOT, snapshot });
    expect(failed.session._tag).toBe('Failed');
    expect(failed.wire).toBe(loaded.wire);
  });

  it('ignores unrelated valid event families', () => {
    const loaded = streaming();
    for (const event of [
      { type: EventType.CUSTOM, name: 'notice', value: {} },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm', delta: 'hello' },
      { type: EventType.STEP_STARTED, stepName: 'analysis' },
    ])
      expect(received(loaded, event)).toBe(loaded);
  });

  it('makes stale events and failures complete Model identity no-ops', () => {
    const next = update(streaming(), Message.ClickedRun()).model;
    expect(received(next, { broken: true })).toBe(next);
    expect(update(next, Message.FailedStream({ runId: 'run-1', error: 'closed' })).model).toBe(
      next,
    );
    expect(activeRun(next)).toEqual({ runId: 'run-2', scenario: 'normal' });
  });

  it('ignores completion after failure or cancellation and closure after completion', () => {
    const loaded = streaming();
    const failed = update(loaded, Message.FailedStream({ runId: 'run-1', error: 'closed' })).model;
    expect(failed.session).toMatchObject({
      _tag: 'Failed',
      failure: { _tag: 'Transport', reason: 'closed' },
    });
    const cancelled = update(loaded, Message.ClickedCancel()).model;
    for (const inactive of [failed, cancelled]) expect(received(inactive, finish)).toBe(inactive);
    const completed = received(loaded, finish);
    expect(completed.session).toEqual(Session.Completed({ runId: 'run-1' }));
    expect(update(completed, Message.FailedStream({ runId: 'run-1', error: 'closed' })).model).toBe(
      completed,
    );
  });

  it.each([
    { type: 'cancelled' },
    { type: 'interrupt', interrupts: [{ id: 'approval', reason: 'approve' }] },
  ])('fails unsupported non-completing terminal outcomes: %j', (outcome) => {
    const failed = received(streaming(), { ...finish, outcome });
    expect(failed.session).toMatchObject({ _tag: 'Failed', failure: { _tag: 'Protocol' } });
    expect(activeRun(failed)).toBeNull();
  });

  it('validates completion identity and accepts explicit success', () => {
    expect(received(streaming(), { ...finish, runId: 'wrong' }).session._tag).toBe('Failed');
    expect(received(streaming(), { ...finish, threadId: 'wrong' }).session._tag).toBe('Failed');
    expect(received(streaming(), { ...finish, outcome: { type: 'success' } }).session._tag).toBe(
      'Completed',
    );
  });

  it('turns agent run errors into protocol failure', () => {
    expect(
      received(streaming(), { type: EventType.RUN_ERROR, message: 'agent failed' }).session,
    ).toMatchObject({ _tag: 'Failed', failure: { _tag: 'Protocol', reason: 'agent failed' } });
  });

  it('recovers exactly once with normal, retaining inspection and requiring a snapshot', () => {
    const inspected = update(
      update(streaming(), Message.ClickedFilter({ filter: 'Core' })).model,
      Message.ClickedService({ id: 'api' }),
    ).model;
    const failed = update(
      { ...inspected, scenario: 'invalid' },
      Message.FailedStream({ runId: 'run-1', error: 'closed' }),
    ).model;
    const recovered = update(failed, Message.ClickedRecover()).model;
    expect(activeRun(recovered)).toEqual({ runId: 'run-2', scenario: 'normal' });
    expect(recovered.wire).toBe(inspected.wire);
    expect(recovered.filter).toBe('Core');
    expect(recovered.selectedId).toBe('api');
    expect(recovered.accepted).toBe(0);
    expect(update(recovered, Message.ClickedRecover()).model).toBe(recovered);
    const started = received(
      recovered,
      { type: EventType.RUN_STARTED, threadId: THREAD_ID, runId: 'run-2' },
      'run-2',
    );
    expect(
      received(started, { type: EventType.STATE_DELTA, delta: [] }, 'run-2').session._tag,
    ).toBe('Failed');
  });

  it('reconciles selection by visible stable ID after filtering, reordering and removal', () => {
    const selected = update(streaming(), Message.ClickedService({ id: 'api' })).model;
    const reordered = received(selected, {
      type: EventType.STATE_SNAPSHOT,
      snapshot: { services: [...wire.services].reverse() },
    });
    expect(reordered.selectedId).toBe('api');
    const filtered = update(reordered, Message.ClickedFilter({ filter: 'Platform' })).model;
    expect(filtered.selectedId).toBeNull();
    expect(visibleServices(filtered).map(({ id }) => id)).toEqual(['worker']);
    expect(update(filtered, Message.ClickedService({ id: 'api' })).model).toBe(filtered);
    expect(delta(selected, [{ op: 'remove', path: '/services/0' }]).selectedId).toBeNull();
    expect(activeRun(filtered)).toBe(activeRun(selected));
  });

  it('caps activity at twelve entries', () => {
    let model = streaming();
    for (let count = 0; count < 20; count++) model = delta(model, []);
    expect(model.activity).toHaveLength(12);
    expect(model.accepted).toBe(21);
  });

  it('selected next scenario never changes the active descriptor', () => {
    const loaded = streaming();
    const changed = update(loaded, Message.SelectedScenario({ scenario: 'slow' })).model;
    expect(activeRun(changed)).toBe(activeRun(loaded));
    expect(activeRun(update(changed, Message.ClickedRun()).model)).toEqual({
      runId: 'run-2',
      scenario: 'slow',
    });
  });

  it('route exit cancels only active states and never creates a replacement', () => {
    const exit = Message.Navigated({
      phase: 'exited',
      path: '/charts',
      previousPath: '/agent-analysis',
    });
    for (const model of [start(), awaiting(), streaming()]) {
      const result = update(model, exit);
      expect(result.model.session).toEqual(
        Session.Cancelled({ runId: 'run-1', cause: 'RouteExit' }),
      );
      expect(activeRun(result.model)).toBeNull();
      expect(result).not.toHaveProperty('commands');
    }
    const completed = received(streaming(), finish);
    expect(update(completed, exit).model).toBe(completed);
    expect(update(initModel, Message.ClickedCancel()).model).toBe(initModel);
  });

  it.each(['coldLoad', 'entered', 'stayed'] as const)(
    'navigation %s never starts or replaces a request',
    (phase) => {
      for (const model of [initModel, streaming()]) {
        const result = update(
          model,
          Message.Navigated({
            phase,
            path: '/agent-analysis/retained',
            previousPath: '/agent-analysis',
          }),
        );
        expect(result.model).toBe(model);
        expect(result).not.toHaveProperty('commands');
      }
    },
  );
});
