/**
 * Lockstep over a simulated network: packets delivered to every other peer after seeded
 * random delays, out of order. However they arrive, every peer applies the same inputs
 * in the same order, and newcomers carry on from the leader's state.
 */
import { expect, test } from 'bun:test';

import { Lockstep } from '../src/kernel/index.ts';
import { seededRandom } from '../src/kernel/seeded.ts';

type Peer = {
  state: Lockstep.Lockstep<string>;
  /** The app's state: every input applied, oldest first. */
  log: ReadonlyArray<string>;
  /** Packets heard before being welcomed. */
  heard: Array<Lockstep.Packet<string>>;
  joined: boolean;
};

type InFlight = {
  readonly at: number;
  readonly to: string;
  readonly packet: Lockstep.Packet<string>;
};

const simulate = (seed: number) => {
  const random = seededRandom(seed);
  const peers = new Map<string, Peer>();
  let flight: Array<InFlight> = [];
  let now = 0;

  const broadcast = (from: string, packet: Lockstep.Packet<string>) => {
    for (const to of peers.keys()) {
      if (to !== from) flight.push({ at: now + 1 + Math.floor(random() * 6), to, packet });
    }
  };

  const advance = (name: string) => {
    const peer = peers.get(name);
    if (peer === undefined || !peer.joined) return;
    const before = peer.state.turn;
    const result = Lockstep.advance(peer.state);
    peer.state = result.state;
    peer.log = [...peer.log, ...result.applied.map((applied) => applied.input)];
    for (const newcomer of Lockstep.welcomeDue(before, peer.state)) {
      const joining = peers.get(newcomer);
      if (joining === undefined) continue;
      // The leader's state as it is now is where the newcomer starts.
      joining.state = Lockstep.join(newcomer, peer.state, joining.heard);
      joining.log = peer.log;
      joining.joined = true;
    }
  };

  const tick = (name: string) => {
    const peer = peers.get(name);
    if (peer === undefined || !peer.joined) return;
    const sent = Lockstep.send(peer.state);
    peer.state = sent.state;
    if (sent.packet !== undefined) broadcast(name, sent.packet);
    advance(name);
  };

  const deliver = () => {
    const due = flight.filter((item) => item.at <= now);
    flight = flight.filter((item) => item.at > now);
    for (const { to, packet } of due) {
      const peer = peers.get(to);
      if (peer === undefined) continue;
      if (peer.joined) peer.state = Lockstep.receive(peer.state, packet);
      else peer.heard.push(packet);
      advance(to);
    }
  };

  const step = (inputs: ReadonlyArray<readonly [string, string]> = []) => {
    now += 1;
    for (const [name, input] of inputs) {
      const peer = peers.get(name);
      if (peer?.joined) peer.state = Lockstep.submit(peer.state, input);
    }
    for (const name of peers.keys()) tick(name);
    deliver();
  };

  return { peers, step, now: () => now };
};

const start = (name: string): Peer => ({
  state: Lockstep.make(name),
  log: [],
  heard: [],
  joined: true,
});

const newcomer = (name: string): Peer => ({
  state: Lockstep.make(name),
  log: [],
  heard: [],
  joined: false,
});

/** The leader admits `name`, as it would on hearing its hello. */
const hello = (sim: ReturnType<typeof simulate>, name: string) => {
  sim.peers.set(name, newcomer(name));
  for (const peer of sim.peers.values()) {
    if (peer.joined) peer.state = Lockstep.admit(peer.state, name);
  }
};

test('peers that join late, with packets delayed and reordered, apply the same inputs in order', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const sim = simulate(seed);
    sim.peers.set('a', start('a'));
    sim.step([['a', 'a0']]);
    hello(sim, 'b');
    for (let i = 0; i < 30; i++)
      sim.step(
        i % 3 === 0
          ? [
              ['a', `a${i}`],
              ['b', `b${i}`],
            ]
          : [],
      );
    hello(sim, 'c');
    for (let i = 0; i < 60; i++) {
      sim.step([
        ['a', `a-${i}`],
        ['b', `b-${i}`],
        ['c', `c-${i}`],
      ]);
    }
    for (let i = 0; i < 40; i++) sim.step();
    const logs = [...sim.peers.values()].map((peer) => peer.log);
    expect(sim.peers.get('c')?.joined).toBe(true);
    expect(logs[0]?.length).toBeGreaterThan(150);
    expect(logs[1]).toEqual(logs[0]);
    expect(logs[2]).toEqual(logs[0]);
  }
});

test('a peer that leaves says where it stopped; one that goes quiet is dropped where all wait', () => {
  const sim = simulate(9);
  sim.peers.set('a', start('a'));
  hello(sim, 'b');
  for (let i = 0; i < 20; i++) sim.step();
  hello(sim, 'c');
  for (let i = 0; i < 20; i++) sim.step([['b', `b${i}`]]);
  // b leaves: everyone stops waiting for it after the turn it sent last.
  const b = sim.peers.get('b');
  const last = b === undefined ? 0 : Lockstep.leave(b.state);
  sim.peers.delete('b');
  for (const peer of sim.peers.values()) peer.state = Lockstep.remove(peer.state, 'b', last + 1);
  for (let i = 0; i < 20; i++) sim.step([['c', `c${i}`]]);
  // c goes quiet: the session stalls on it, and the leader drops it where all wait.
  const quiet = sim.peers.get('c');
  sim.peers.delete('c');
  for (let i = 0; i < 10; i++) sim.step([['a', `stalled${i}`]]);
  const a = sim.peers.get('a');
  expect(a === undefined ? [] : Lockstep.waitingOn(a.state)).toEqual(['c']);
  if (a !== undefined) a.state = Lockstep.remove(a.state, 'c', a.state.turn);
  for (let i = 0; i < 10; i++) sim.step([['a', `after${i}`]]);
  expect(sim.peers.get('a')?.log).toContain('after5');
  expect(sim.peers.get('a')?.log).toContain('stalled9');
  // What c applied before going quiet is a prefix of what a applied.
  const cLog = quiet?.log ?? [];
  expect(sim.peers.get('a')?.log.slice(0, cLog.length)).toEqual([...cLog]);
});

test('only the leader admits, and the newcomer is a member lead + 1 turns after', () => {
  const a = Lockstep.make<string>('a');
  const notLeader = Lockstep.join<string>('z', {
    turn: 0,
    lead: 2,
    members: [
      { peer: 'a', from: 0, until: null },
      { peer: 'z', from: 0, until: null },
    ],
  });
  expect(Lockstep.admit(notLeader, 'b')).toBe(notLeader);
  const admitting = Lockstep.send(Lockstep.admit(a, 'b'));
  const applied = Lockstep.advance(admitting.state);
  expect(applied.state.members).toContainEqual({ peer: 'b', from: 3, until: null });
  expect(Lockstep.membersAt(applied.state, 2)).toEqual(['a']);
  expect(Lockstep.membersAt(applied.state, 3)).toEqual(['a', 'b']);
  expect(Lockstep.leaderAt(applied.state, 3)).toBe('a');
});

test('within a turn, inputs apply in peer order, whichever packet came first', () => {
  const members = [
    { peer: 'a', from: 0, until: null },
    { peer: 'b', from: 0, until: null },
  ];
  const b = Lockstep.send(
    Lockstep.submit(Lockstep.join<string>('b', { turn: 0, lead: 2, members }), 'from b'),
  );
  const a = Lockstep.send(
    Lockstep.submit(Lockstep.join<string>('a', { turn: 0, lead: 2, members }), 'from a'),
  );
  // b hears its own packet first, then a's.
  const heard = Lockstep.advance(
    Lockstep.receive(b.state, a.packet ?? { peer: 'a', turn: 0, entries: [] }),
  );
  expect(heard.applied).toEqual([
    { turn: 0, peer: 'a', input: 'from a' },
    { turn: 0, peer: 'b', input: 'from b' },
  ]);
});

test('a newcomer whose id sorts first is still welcomed, by the leader it joined', () => {
  const sim = simulate(11);
  sim.peers.set('m', start('m'));
  sim.step([['m', 'm0']]);
  hello(sim, 'a');
  for (let i = 0; i < 20; i++)
    sim.step([
      ['a', `a${i}`],
      ['m', `m${i}`],
    ]);
  for (let i = 0; i < 20; i++) sim.step();
  expect(sim.peers.get('a')?.joined).toBe(true);
  expect(sim.peers.get('a')?.log).toEqual(sim.peers.get('m')?.log);
  // Once a counts, it leads: its id sorts first.
  const a = sim.peers.get('a');
  expect(a === undefined ? undefined : Lockstep.leaderAt(a.state, a.state.turn)).toBe('a');
});
