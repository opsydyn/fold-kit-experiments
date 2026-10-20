/**
 * Tabletop peers, simulated: what each one says reaches the others, turns tick, and each
 * peer's world (a stand-in that goes straight to `until` and reports a checksum of the
 * balls it holds) reports back. Every peer gives its world the same throws at the same
 * steps, newcomers replay the record, and the checks agree.
 */
import { expect, test } from 'bun:test';

import { Option } from 'effect';

import { Message } from '../src/tabletop/message';
import { fresh, init, type Model } from '../src/tabletop/model';
import { fragmentOf, recordIn, recordOf } from '../src/tabletop/replay';
import { snapshotAtOf, throwAt, untilOf, update } from '../src/tabletop/update';
import { checkEvery, stepsPerTurn, type Wire } from '../src/tabletop/wire';

type Peer = {
  model: Model;
  outbox: Array<Wire>;
  /** Commands other than `Say`, by name. */
  commands: Array<string>;
  /** The stand-in world: its run, its step, and the balls it had at each step it reached. */
  world: { run: number; step: number | null };
  seen: Map<number, string>;
  /** The snapshot the world's run started from, if it did. */
  startedFrom?: { readonly step: number; readonly snapshot: string } | undefined;
};

const run = (peer: Peer, message: Message) => {
  const result = update(peer.model, message);
  peer.model = result.model;
  for (const command of result.commands ?? []) {
    if (command.name !== 'Say') {
      peer.commands.push(command.name);
      continue;
    }
    // SAFETY: a `Say` Command's arguments are `{ wire, via }`, as `session.ts` defines it.
    peer.outbox.push((command.args as { readonly wire: Wire }).wire);
  }
};

/** What the world holds, as a checksum would see it: its balls, by key and start. */
const holding = (model: Model): string =>
  `${model.build}:${model.balls.map((ball) => `${ball.key}@${ball.from.join(',')}`).join(';')}`;

/**
 * The world goes to `until` and reports, if it moved, with a snapshot (what it holds)
 * where the Model asks for one. A new run starts at 0, or at the step of the snapshot it
 * starts from, holding what that snapshot held.
 */
const stepWorld = (peer: Peer) => {
  if (peer.world.run !== peer.model.run) {
    const from = Option.getOrUndefined(peer.model.start);
    peer.world = { run: peer.model.run, step: from?.step ?? null };
    peer.seen = new Map();
    peer.startedFrom = from;
  }
  const until = untilOf(peer.model);
  if (peer.world.step !== null && until <= peer.world.step) return;
  peer.world.step = until;
  const balls = holding(peer.model);
  peer.seen.set(until, balls);
  const snapshot = snapshotAtOf(peer.model) === until ? balls : null;
  run(peer, Message.ReachedStep({ run: peer.model.run, step: until, checksum: balls, snapshot }));
};

const clock = { now: 0 };

/** Every peer hears the others, ticks, and lets its world catch up, `times` over. */
const exchange = (peers: ReadonlyArray<Peer>, times: number) => {
  for (let i = 0; i < times; i++) {
    clock.now += 50;
    const said = peers.map((peer) => peer.outbox.splice(0));
    peers.forEach((peer, index) => {
      said.forEach((wires, from) => {
        if (from !== index)
          for (const wire of wires) run(peer, Message.HeardWire({ wire, at: clock.now }));
      });
    });
    for (const peer of peers) {
      run(peer, Message.TickedTurn({ at: clock.now }));
      for (let catchUp = 0; catchUp < 40; catchUp++) stepWorld(peer);
    }
  }
};

const opened = (name: string): Peer => {
  const peer: Peer = {
    model: init().model,
    outbox: [],
    commands: [],
    world: { run: 0, step: null },
    seen: new Map(),
  };
  run(peer, Message.NamedTab({ peer: name, at: 0, relay: Option.none(), record: Option.none() }));
  stepWorld(peer);
  return peer;
};

const live = (peer: Peer) => peer.model.session._tag === 'Live';

test('peers give their worlds the same throws at the same steps; a newcomer starts from a snapshot', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  expect(live(a)).toBe(true);
  run(a, Message.ClickedTable({ point: [0, 1, 0] }));
  exchange([a], 30);
  expect(a.model.balls.map((ball) => ball.key)).toEqual(['ball-0']);
  run(a, Message.ClickedTable({ point: [1, 0.5, -1] }));
  exchange([a], 30);

  const b = opened('b');
  exchange([a, b], 20);
  expect(live(b)).toBe(true);
  // b's world is a new run, started from a's latest snapshot (taken at a check step) with
  // the balls a had there, not replayed from step 0.
  expect(b.model.run).toBe(1);
  const from = b.startedFrom;
  expect(from?.step).toBeGreaterThan(0);
  expect((from?.step ?? 1) % checkEvery).toBe(0);
  expect(from?.snapshot).toBe(a.seen.get(from?.step ?? -1));
  expect(Math.min(...b.seen.keys())).toBeGreaterThanOrEqual(from?.step ?? 0);
  run(a, Message.ClickedTable({ point: [-1, 0.5, 0] }));
  run(b, Message.ClickedTable({ point: [0.5, 0.2, 1] }));
  run(b, Message.ClickedRebuild());
  run(a, Message.ClickedTable({ point: [0, 0.4, 0] }));
  exchange([a, b], 120);

  expect(b.model.balls).toEqual(a.model.balls);
  expect(b.model.build).toBe(1);
  // At every step both worlds reached, they held the same balls.
  const shared = [...a.seen.keys()].filter((step) => b.seen.has(step));
  expect(shared.length).toBeGreaterThan(10);
  for (const step of shared) expect(b.seen.get(step)).toBe(a.seen.get(step));
  // And their checks, a second of steps apart, agreed.
  expect(a.model.agreed).toBeGreaterThan(2);
  expect(b.model.agreed).toBeGreaterThan(2);
  expect(a.model.diverged).toEqual(Option.none());
  expect(b.model.diverged).toEqual(Option.none());
});

test('a world that went another way is found out at the next check', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  const b = opened('b');
  exchange([a, b], 20);
  // b's world reports a checksum of its own at its next check step.
  const next = (Math.floor((b.model.timeline.reached ?? 0) / checkEvery) + 1) * checkEvery;
  b.model = { ...b.model, checksFrom: next + checkEvery };
  exchange([a, b], 30);
  run(
    b,
    Message.ReachedStep({
      run: b.model.run,
      step: next + checkEvery,
      checksum: 'other',
      snapshot: null,
    }),
  );
  b.world.step = next + checkEvery;
  exchange([a, b], 30);
  expect(a.model.diverged).toEqual(Option.some(next + checkEvery));
});

test('a turn’s throw lands at that turn’s step, where the world waits for it', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  exchange([a], 10);
  const frontier = a.model.timeline.frontier;
  expect(frontier % stepsPerTurn).toBe(0);
  // The world never passes the frontier the session agreed.
  expect(a.world.step).toBeLessThanOrEqual(frontier);
  run(a, Message.ClickedTable({ point: [0, 0, 0] }));
  exchange([a], 4);
  const [landed] = a.model.timeline.inputs;
  // At the turn it went out in: the frontier, or a turn or two on.
  expect(landed?.step).toBeGreaterThanOrEqual(frontier);
  expect((landed?.step ?? -1) % stepsPerTurn).toBe(0);
  expect(a.seen.has(landed?.step ?? -1)).toBe(true);
});

test('a hidden peer with others steps out, and joins again when shown; alone, it stays', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  run(a, Message.ChangedVisibility({ hidden: true }));
  expect(live(a)).toBe(true);
  run(a, Message.ChangedVisibility({ hidden: false }));
  const b = opened('b');
  exchange([a, b], 20);
  run(b, Message.ChangedVisibility({ hidden: true }));
  expect(b.model.session._tag).toBe('Offline');
  expect(b.model.away).toBe(true);
  expect(b.outbox.at(-1)?._tag).toBe('Bye');
  exchange([a, b], 4);
  run(b, Message.ChangedVisibility({ hidden: false }));
  expect(b.commands.at(-1)).toBe('NameTab');
});

test('a peer that loses the relay plays on alone from where its world is', () => {
  const a = opened('a');
  a.model = { ...a.model, relay: Option.some({ url: 'ws://relay.test/t', link: 'Open' }) };
  run(a, Message.WaitedForWelcome());
  exchange([a], 20);
  const frontier = a.model.timeline.frontier;
  run(a, Message.LostRelay());
  expect(live(a)).toBe(true);
  exchange([a], 10);
  expect(a.model.timeline.frontier).toBeGreaterThan(frontier);
  expect(update(a.model, Message.ClickedReconnect()).commands?.map((c) => c.name)).toEqual([
    'NameTab',
  ]);
});

test('reports from an old run are ignored; throws aim from the near edge', () => {
  const model: Model = { ...fresh, run: 2 };
  expect(
    update(model, Message.ReachedStep({ run: 1, step: 0, checksum: 'x', snapshot: null })).model,
  ).toBe(model);
  const thrown = throwAt([0, 0, 0], 'gold');
  expect(thrown.from[2]).toBeGreaterThan(5);
  expect(thrown.impulse[2]).toBeLessThan(0);
});

test('a third peer joining after throws from both and a rebuild catches up and agrees', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  for (const x of [0, 1, -1]) {
    run(a, Message.ClickedTable({ point: [x, 0.5, 0] }));
    exchange([a], 8);
  }
  const b = opened('b');
  exchange([a, b], 20);
  for (let i = 0; i < 4; i++) {
    run(i % 2 === 0 ? a : b, Message.ClickedTable({ point: [i * 0.3, 0.4, 0] }));
    exchange([a, b], 2);
  }
  run(a, Message.ClickedRebuild());
  exchange([a, b], 10);
  for (let i = 0; i < 4; i++) {
    run(i % 2 === 0 ? b : a, Message.ClickedTable({ point: [i * 0.2, 0.4, 0] }));
    run(i % 2 === 0 ? a : b, Message.ClickedTable({ point: [-i * 0.2, 0.4, 0] }));
    exchange([a, b], 1);
  }
  exchange([a, b], 200);

  const c = opened('c');
  exchange([a, b, c], 20);
  run(c, Message.ClickedTable({ point: [0, 0.5, 0] }));
  exchange([a, b, c], 200);
  expect(c.model.session._tag).toBe('Live');
  expect(c.model.balls).toEqual(a.model.balls);
  expect(c.model.build).toBe(a.model.build);
  expect(c.world.step).toBeGreaterThan(a.world.step === null ? 0 : a.world.step - 30);
  expect(c.model.agreed).toBeGreaterThan(2);
  expect(c.model.diverged).toEqual(Option.none());
  // c started from a snapshot taken after the rebuild, and its record is still whole.
  expect(c.startedFrom?.step).toBeGreaterThan(0);
  expect(c.model.timeline.inputs).toEqual(a.model.timeline.inputs);
});

test('a newcomer welcomed before the leader has a snapshot replays from step 0', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  run(a, Message.ClickedTable({ point: [0, 1, 0] }));
  exchange([a], 4);
  expect(a.model.kept).toEqual(Option.none());
  const b = opened('b');
  exchange([a, b], 20);
  expect(b.startedFrom).toBeUndefined();
  expect(b.seen.has(0)).toBe(true);
  exchange([a, b], 60);
  expect(b.model.balls).toEqual(a.model.balls);
  expect(b.model.diverged).toEqual(Option.none());
});

test('only the leader snapshots its world, at check steps', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  exchange([a], 30);
  const b = opened('b');
  exchange([a, b], 60);
  const [leader, other] = snapshotAtOf(a.model) === null ? [b, a] : [a, b];
  expect((snapshotAtOf(leader.model) ?? 1) % checkEvery).toBe(0);
  expect(snapshotAtOf(other.model)).toBeNull();
});

test('a game becomes a record in a link, and replaying it meets every check', () => {
  const a = opened('a');
  run(a, Message.WaitedForWelcome());
  for (const x of [0, 1, -1]) {
    run(a, Message.ClickedTable({ point: [x, 0.5, 0] }));
    exchange([a], 12);
  }
  run(a, Message.ClickedRebuild());
  exchange([a], 60);
  const record = Option.getOrThrow(recordOf(a.model));
  expect(record.checks.length).toBeGreaterThan(2);
  expect(record.inputs).toHaveLength(4);
  // Through the address and back, unchanged; anything else is no record.
  const fragment = fragmentOf(record);
  expect(fragment).toMatch(/^#replay=[\w-]+$/);
  expect(recordIn(fragment)).toEqual(Option.some(record));
  expect(recordIn('#replay=not-a-record')).toEqual(Option.none());
  expect(recordIn('#other')).toEqual(Option.none());

  // A page opened with the link replays: no session, the world on the record, checked.
  const r: Peer = {
    model: init().model,
    outbox: [],
    commands: [],
    world: { run: 0, step: null },
    seen: new Map(),
  };
  run(r, Message.NamedTab({ peer: 'r', at: 0, relay: Option.none(), record: recordIn(fragment) }));
  expect(r.model.session._tag).toBe('Offline');
  exchange([r], 200);
  expect(r.outbox).toEqual([]);
  expect(r.model.timeline.reached).toBe(record.until);
  expect(r.seen.get(record.until)).toBe(a.seen.get(record.until));
  expect(r.model.agreed).toBe(record.checks.length);
  expect(r.model.diverged).toEqual(Option.none());
  // A record that does not match the world is found out at its first check.
  const forged = { ...record, checks: record.checks.map((check) => ({ ...check, checksum: 'x' })) };
  const f: Peer = { ...r, model: init().model, outbox: [], world: { run: 0, step: null } };
  run(f, Message.NamedTab({ peer: 'f', at: 0, relay: Option.none(), record: Option.some(forged) }));
  exchange([f], 200);
  expect(f.model.diverged).toEqual(Option.some(forged.checks[0]?.step ?? -1));
});
