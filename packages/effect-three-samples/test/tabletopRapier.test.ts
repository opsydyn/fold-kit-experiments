/**
 * The tabletop with real worlds: each peer's Model drives a scene graph on Rapier's
 * deterministic build, and what the world reports goes back to the Model. Over a network
 * that delays every message, predicting peers roll back for throws that come late, and
 * their worlds still agree, checksum for checksum, with each other and with a peer that
 * never predicts.
 */
import { expect, test } from 'bun:test';

import {
  createSceneGraph,
  createSceneLoop,
  type PhysicsEngine,
  recordingRendererFactory,
} from '@opsydyn/effect-three';
import { loadRapier } from '@opsydyn/effect-three-rapier/deterministic';
import { Option } from 'effect';

import { Message } from '../src/tabletop/message';
import { init, type Model } from '../src/tabletop/model';
import { sceneFor } from '../src/tabletop/scene';
import { update } from '../src/tabletop/update';
import type { Wire } from '../src/tabletop/wire';

const engine: PhysicsEngine = await loadRapier();

type Peer = {
  model: Model;
  readonly outbox: Array<Wire>;
  readonly frame: () => void;
  readonly dispose: () => void;
  /** Every step the world reported, with its checksum, in the run that last reached it. */
  readonly seen: Map<number, string>;
};

const peerOf = (name: string, predict: boolean, clock: { now: number }): Peer => {
  const graph = createSceneGraph({ physics: engine });
  const reports: Array<Message> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => clock.now / 1000,
    emit: (event) => {
      if (event._tag !== 'PhysicsReached') return;
      const { run, step, checksum } = event;
      reports.push(Message.ReachedStep({ run, step, checksum, snapshot: event.snapshot ?? null }));
    },
  });
  const peer: Peer = {
    model: init().model,
    outbox: [],
    seen: new Map(),
    // A frame: the world is shown the Model, steps, and its reports go back to the Model.
    frame: () => {
      graph.reconcile(sceneFor(peer.model));
      loop.frame();
      for (const report of reports.splice(0)) {
        if (report._tag === 'ReachedStep' && report.run === peer.model.run) {
          peer.seen.set(report.step, report.checksum);
        }
        run(peer, report);
      }
    },
    dispose: () => graph.dispose(),
  };
  run(
    peer,
    Message.NamedTab({ peer: name, at: 0, relay: Option.none(), predict, record: Option.none() }),
  );
  return peer;
};

function run(peer: Peer, message: Message) {
  const result = update(peer.model, message);
  peer.model = result.model;
  for (const command of result.commands ?? []) {
    if (command.name !== 'Say') continue;
    // SAFETY: a `Say` Command's arguments are `{ wire, via }`, as `session.ts` defines it.
    peer.outbox.push((command.args as { readonly wire: Wire }).wire);
  }
}

/**
 * Turns of 50 ms, three frames each: what peers say arrives `delay` turns later, then each
 * peer ticks its turn and lets its world go.
 */
const play = (peers: ReadonlyArray<Peer>, turns: number, delay: number, clock: { now: number }) => {
  const inFlight: Array<{ from: Peer; wire: Wire; turns: number }> = [];
  return (more = turns) => {
    for (let turn = 0; turn < more; turn++) {
      for (const peer of peers) {
        for (const wire of peer.outbox.splice(0)) inFlight.push({ from: peer, wire, turns: delay });
      }
      const arriving = inFlight.filter((each) => each.turns <= 0);
      inFlight.splice(0, inFlight.length, ...inFlight.filter((each) => each.turns > 0));
      for (const each of inFlight) each.turns -= 1;
      for (const peer of peers) {
        for (const { from, wire } of arriving) {
          if (from !== peer) run(peer, Message.HeardWire({ wire, at: clock.now }));
        }
        run(peer, Message.TickedTurn({ at: clock.now }));
      }
      for (let frame = 0; frame < 3; frame++) {
        clock.now += 50 / 3;
        for (const peer of peers) peer.frame();
      }
    }
  };
};

/** Two peers playing over a slow network: throws from both, a rebuild, and time to settle. */
const game = (predictA: boolean, predictB: boolean, delay: number) => {
  const clock = { now: 0 };
  const a = peerOf('a', predictA, clock);
  const b = peerOf('b', predictB, clock);
  const turns = play([a, b], 0, delay, clock);
  run(a, Message.WaitedForWelcome());
  turns(20);
  turns(30);
  for (let i = 0; i < 10; i++) {
    run(i % 2 === 0 ? a : b, Message.ClickedTable({ point: [i * 0.15 - 0.7, 0.5, 0] }));
    turns(1);
    run(i % 2 === 0 ? b : a, Message.ClickedTable({ point: [0.6 - i * 0.1, 0.8, -0.5] }));
    if (i === 6) run(a, Message.ClickedRebuild());
    turns(1);
  }
  turns(120);
  a.dispose();
  b.dispose();
  return { a, b };
};

/** The peers agree: the same table, checks agreed and none out of step, the same worlds. */
const agreeing = ({ a, b }: { readonly a: Peer; readonly b: Peer }) => {
  expect(a.model.session._tag).toBe('Live');
  expect(b.model.session._tag).toBe('Live');
  expect(b.model.balls).toEqual(a.model.balls);
  expect(a.model.diverged).toEqual(Option.none());
  expect(b.model.diverged).toEqual(Option.none());
  expect(a.model.agreed + b.model.agreed).toBeGreaterThan(2);
  const shared = [...a.seen.keys()].filter((step) => b.seen.has(step) && step % 60 === 0);
  expect(shared.length).toBeGreaterThan(2);
  for (const step of shared) expect(b.seen.get(step)).toBe(a.seen.get(step));
};

test('predicting peers on Rapier roll back for late throws, and their worlds agree', () => {
  const played = game(true, true, 2);
  agreeing(played);
  expect(played.a.model.rollbacks + played.b.model.rollbacks).toBeGreaterThan(2);
}, 60_000);

test('on Rapier, a predicting peer and one that does not play one world', () => {
  const played = game(true, false, 2);
  agreeing(played);
  expect(played.a.model.rollbacks).toBeGreaterThan(0);
  expect(played.b.model.rollbacks).toBe(0);
}, 60_000);
