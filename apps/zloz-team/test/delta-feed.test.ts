import { expect, test } from 'bun:test';

import { createOperationDocument, parseGraph } from '@opsydyn/foldkit-zloz';
import { Effect, Stream } from 'effect';

import fixture from '../../../packages/foldkit-zloz/test/fixtures/operations-v1.json';
import { init, Message, update } from '../src/editor/main';
import { deltaEntries, deltaStream } from '../src/editor/protocol';
const props = {
  teamId: 'team-a',
  diagramId: 'diagram-a',
  actorId: 'alice',
  role: 'owner' as const,
  name: 'Delta test',
};
const room = { ...props, generation: 'generation' };
const target = { teamId: props.teamId, diagramId: props.diagramId };
const frame = {
  target,
  sourceVersion: 10,
  document: createOperationDocument(
    parseGraph(JSON.stringify({ version: 1, graph: fixture.graph })),
  ),
  coverage: [],
};
const feed = { format: 'foldkit-zloz-feed', version: 1, target, cursor: 70, sourceVersion: 10 };
const noop = (previousSourceVersion = 10) =>
  ({
    format: 'foldkit-zloz-delta',
    version: 1,
    target,
    previousSourceVersion,
    sourceVersion: previousSourceVersion + 1,
    payload: { kind: 'noop' },
  }) as const;
const ready = () =>
  update(
    update(init(props).model, Message.SucceededIdentity({ generation: room.generation })).model,
    Message.SucceededSnapshot({ room, run: 0, frame, feed, role: 'owner' }),
  ).model;

test('SDK cursor and source versions advance independently; duplicates/gaps cannot acknowledge edits', () => {
  let model = ready();
  expect(model.feedMode).toBe('delta');
  model = update(model, Message.ObservedCaughtUp({ room, run: 0, cursor: 70 })).model;
  expect(model.connection._tag).toBe('Live');
  model = update(model, Message.ObservedDelta({ room, run: 0, cursor: 71, delta: noop() })).model;
  expect(model.session.confirmed?.sourceVersion).toBe(11);
  expect(model.feedSeeds[0]?.feed.cursor).toBe(70);
  expect(model.feedProgress[0]?.cursor).toBe(71);
  const failed = update(
    model,
    Message.ObservedDelta({ room, run: 0, cursor: 73, delta: noop(11) }),
  ).model;
  expect(failed.connection._tag).toBe('Reconnecting');
  expect(failed.session.confirmed).toBe(model.session.confirmed);
  expect(failed.socketRun).toBe(1);
});

test('bootstrap ahead of its frontier safely covers replay without skipping cursor validation', () => {
  const initial = update(
    ready(),
    Message.SucceededSnapshot({
      room,
      run: 0,
      frame: { ...frame, sourceVersion: 12 },
      feed,
      role: 'owner',
    }),
  ).model;
  const first = update(
    initial,
    Message.ObservedDelta({ room, run: 0, cursor: 71, delta: noop() }),
  ).model;
  expect(first.session.confirmed?.sourceVersion).toBe(12);
  expect(first.connection._tag).toBe('Opening');
  const second = update(
    first,
    Message.ObservedDelta({ room, run: 0, cursor: 72, delta: noop(11) }),
  ).model;
  expect(second.connection._tag).toBe('Live');
  expect(second.session.confirmed?.sourceVersion).toBe(12);
});

test('replacement HTTP bootstrap and stale caught-up markers preserve the live channel until source catch-up', () => {
  let model = update(ready(), Message.ObservedCaughtUp({ room, run: 0, cursor: 70 })).model;
  model = update(model, Message.ObservedRenewal({ room, run: 0 })).model;
  model = update(
    model,
    Message.SucceededSnapshot({ room, run: 1, frame, feed, role: 'owner' }),
  ).model;
  model = update(model, Message.ObservedDelta({ room, run: 0, cursor: 71, delta: noop() })).model;
  model = update(model, Message.ObservedCaughtUp({ room, run: 1, cursor: 70 })).model;
  expect(model.connection._tag).toBe('Handoff');
  expect(model.socketSlot).toBe('a');
  model = update(model, Message.ObservedDelta({ room, run: 1, cursor: 71, delta: noop() })).model;
  expect(model.connection._tag).toBe('Live');
  expect(model.socketSlot).toBe('b');
});

test('wrong targets, malformed deltas and impossible caught-up markers resync without replacing canonical state', () => {
  for (const message of [
    Message.ObservedDelta({
      room,
      run: 0,
      cursor: 71,
      delta: { ...noop(), target: { ...target, teamId: 'other' } },
    }),
    Message.ObservedDelta({
      room,
      run: 0,
      cursor: 71,
      delta: { ...noop(), previousSourceVersion: 12, sourceVersion: 13 },
    }),
    Message.ObservedDelta({ room, run: 0, cursor: 71, delta: null }),
    Message.ObservedCaughtUp({ room, run: 0, cursor: 72 }),
  ]) {
    const model = ready();
    const failed = update(model, message).model;
    expect(failed.session.confirmed).toBe(model.session.confirmed);
    expect(failed.socketRun).toBe(1);
  }
});

test('wire decoder accepts sanitized SDK entries and refuses failures or malformed values', () => {
  const chunk = (values: unknown[]) => JSON.stringify({ _tag: 'Chunk', values });
  expect(deltaEntries(chunk([{ _tag: 'CaughtUp', cursor: 70 }]))).toEqual([
    { kind: 'caught-up', cursor: 70 },
  ]);
  expect(
    deltaEntries(
      chunk([
        {
          event: { _tag: 'PublicDelta', delta: noop() },
          state: { sourceVersion: 11 },
          envelope: { seq: 71 },
        },
      ]),
    ),
  ).toEqual([{ kind: 'delta', cursor: 71, delta: noop() }]);
  for (const value of [
    'garbage',
    '{"_tag":"Exit"}',
    chunk([{ event: { _tag: 'PrivateDecision' }, envelope: { seq: 71 } }]),
    chunk([{ _tag: 'CaughtUp', cursor: -1 }]),
  ])
    expect(() => deltaEntries(value)).toThrow();
});

test('bounded transport overflow fails visibly and closes the socket instead of sliding over missing deltas', async () => {
  const previousSocket = globalThis.WebSocket;
  const previousLocation = globalThis.location;
  let fake: FakeSocket | undefined;
  class FakeSocket extends EventTarget {
    closed = false;
    constructor(_url: URL) {
      super();
      fake = this;
    }
    close() {
      this.closed = true;
    }
  }
  // SAFETY: scoped browser-boundary fixture supplies only APIs consumed by deltaStream.
  Object.assign(globalThis, { WebSocket: FakeSocket, location: { origin: 'http://localhost' } });
  // oxlint-disable-next-line linteffect/no-try-catch -- finally restores borrowed browser globals even when an assertion fails.
  try {
    const running = Effect.runPromise(
      deltaStream(
        room,
        70,
        (entry) => entry.kind,
        () => 'resync',
      ).pipe(Stream.runCollect),
    );
    while (!fake) await Bun.sleep(1);
    for (let i = 0; i < 80; i++)
      fake.dispatchEvent(
        new MessageEvent('message', {
          data: JSON.stringify({ _tag: 'Chunk', values: [{ _tag: 'CaughtUp', cursor: 70 }] }),
        }),
      );
    const values = await running;
    expect(values.at(-1)).toBe('resync');
    expect(values.length).toBeLessThanOrEqual(34);
    expect(fake.closed).toBe(true);
  } finally {
    Object.assign(globalThis, { WebSocket: previousSocket, location: previousLocation });
  }
});
