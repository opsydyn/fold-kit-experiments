import { Lockstep, Timeline, type Vec3 } from '@opsydyn/effect-three';
import { Match, Option } from 'effect';
import type { Return } from 'foldkit/update';

import { nextPaint, type Paint } from '../palette';
import { Message } from './message';
import { fresh, type Model } from './model';
import type { Record } from './replay';
import { NameTab, type RelayService, Say, selfOf, WaitForWelcome } from './session';
import {
  checkEvery,
  type Input,
  type Packet,
  type Play,
  quietMilliseconds,
  type Relay,
  stepsPerTurn,
  type Throw,
  type Wire,
} from './wire';

type AppReturn = Return<Model, Message, RelayService>;
type Live = Extract<Model['session'], { readonly _tag: 'Live' }>;

/** The most balls on the table: older ones are cleared away as new ones come. */
const mostBalls = 30;

/**
 * How many of its own checksums a peer keeps, for checks that come late; and, four times
 * over, others' checks for steps its world has not reached (a world off screen waits).
 */
const keptChecks = 30;

/** Turns a peer may send ahead: an input waits about this many turns. */
const lead = 2;

// THE WORLD

/** A throw or rebuild, as the world gets it: while it waits at the step it lands at. */
const play = (model: Model, input: Play): Model =>
  Match.valueTags(input, {
    Throw: ({ from, impulse, paint }) => ({
      ...model,
      thrown: model.thrown + 1,
      balls: [...model.balls, { key: `ball-${model.thrown}`, from, impulse, paint }].slice(
        -mostBalls,
      ),
    }),
    Rebuild: () => ({ ...model, build: model.build + 1, balls: [] }),
  });

/** What is due where the world waits now, handed to it. */
const deliver = (model: Model): Model => {
  const { timeline, inputs } = Timeline.due(model.timeline);
  return inputs.reduce(play, { ...model, timeline });
};

/**
 * The next step a check is due at, after `reached`: none before `from`, where this peer
 * joined, so a newcomer replaying the record stops only where throws land.
 */
const nextCheck = (reached: number | null, from: number): number => {
  const after = reached === null ? 0 : (Math.floor(reached / checkEvery) + 1) * checkEvery;
  return Math.max(after, Math.ceil(from / checkEvery) * checkEvery);
};

/**
 * Where the world stops next: the next step with a throw, the frontier the session has
 * agreed so far, or the next check, whichever comes first.
 */
export const untilOf = (model: Model): number =>
  Math.min(Timeline.until(model.timeline), nextCheck(model.timeline.reached, model.checksFrom));

/** A throw from the near edge towards `point`, a little above it. */
export const throwAt = (point: Vec3, paint: Paint): Throw => {
  const from: Vec3 = [point[0] * 0.5, 1.4, 5.4];
  const toward = [point[0] - from[0], point[1] + 0.9 - from[1], point[2] - from[2]];
  const length = Math.hypot(...toward) || 1;
  const strength = 4.5;
  return {
    _tag: 'Throw',
    from,
    impulse: [
      (toward[0] ?? 0) * (strength / length),
      (toward[1] ?? 0) * (strength / length),
      (toward[2] ?? 0) * (strength / length),
    ],
    paint,
  };
};

// CHECKS

/** Another peer's checksum for `step`, against this peer's when it has it. */
const compare = (model: Model, step: number, checksum: string): Model => {
  const mine = model.checksums.find((each) => each.step === step);
  if (mine === undefined) {
    // Not reached yet: kept for when it is. Already passed and not kept: let go.
    const reached = model.timeline.reached ?? -1;
    return step > reached
      ? { ...model, awaiting: [...model.awaiting, { step, checksum }].slice(-keptChecks * 4) }
      : model;
  }
  return mine.checksum === checksum
    ? { ...model, agreed: model.agreed + 1 }
    : { ...model, diverged: Option.orElse(model.diverged, () => Option.some(step)) };
};

/** This peer's checksum at a check step: kept, compared with what waited for it, shared. */
const checked = (model: Model, step: number, checksum: string): Model => {
  const waiting = model.awaiting.filter((each) => each.step === step);
  const kept: Model = {
    ...model,
    checksums: [...model.checksums, { step, checksum }].slice(-keptChecks),
    awaiting: model.awaiting.filter((each) => each.step !== step),
  };
  const compared = waiting.reduce((at, each) => compare(at, each.step, each.checksum), kept);
  return propose(compared, { _tag: 'Check', step, checksum });
};

/** The world reached `step` in this peer's run: what is due there, and a check when one is. */
const reach = (model: Model, run: number, step: number, checksum: string): Model => {
  if (run !== model.run || model.timeline.reached === step) return model;
  const reached = deliver({
    ...model,
    timeline: Timeline.reach(model.timeline, step),
    reached: Option.some({ step, checksum }),
  });
  return step % checkEvery === 0 && step >= model.checksFrom
    ? checked(reached, step, checksum)
    : reached;
};

// PROPOSING

/** An input for this peer's next turn packet; nothing while not in a session. */
const propose = (model: Model, input: Input): Model =>
  model.session._tag === 'Live'
    ? {
        ...model,
        session: { ...model.session, lockstep: Lockstep.submit(model.session.lockstep, input) },
      }
    : model;

const throwToward = (model: Model, point: Vec3): Model =>
  model.session._tag === 'Live'
    ? { ...propose(model, throwAt(point, model.paint)), paint: nextPaint(model.paint) }
    : model;

// SESSION

const live = (model: Model, session: Live): Model => ({ ...model, session });

/** Says `wire` to the others: through the relay when the page names one, else the channel. */
const say = (model: Model, wire: Wire) =>
  Say({ wire, via: Option.isSome(model.relay) ? 'relay' : 'tabs' });

/** The Welcome for `peer`: the session as it is, and every throw so far to replay. */
const welcome = (model: Model, lockstep: Lockstep.Lockstep<Input>, peer: string): Wire => ({
  _tag: 'Welcome',
  to: peer,
  turn: lockstep.turn,
  lead: lockstep.lead,
  members: lockstep.members,
  record: model.timeline.inputs,
});

/** A turn's throws and rebuilds, at that turn's step: the frontier, until it applies. */
const schedule = (model: Model, turn: number, input: Play): Model => ({
  ...model,
  timeline: Timeline.schedule(model.timeline, turn * stepsPerTurn, input),
});

/**
 * Every turn whose packets are all in, applied: throws and rebuilds into the timeline at
 * their turn's step, others' checks compared; the frontier moved on, what is due handed to
 * the world, and a Welcome to any newcomer whose first turn has come.
 */
const settle = (model: Model, session: Live): AppReturn => {
  const before = session.lockstep.turn;
  const result = Lockstep.advance(session.lockstep);
  const { self } = result.state;
  const applied = result.applied.reduce(
    (at, { turn, peer, input }) =>
      Match.valueTags(input, {
        Throw: (thrown) => schedule(at, turn, thrown),
        Rebuild: (rebuild) => schedule(at, turn, rebuild),
        Check: ({ step, checksum }) => (peer === self ? at : compare(at, step, checksum)),
      }),
    live(model, { ...session, lockstep: result.state }),
  );
  const settled = deliver({
    ...applied,
    timeline: Timeline.extend(applied.timeline, result.state.turn * stepsPerTurn),
  });
  const newcomers = Lockstep.welcomeDue(before, result.state);
  return {
    model: settled,
    commands: newcomers.map((peer) => say(settled, welcome(settled, result.state, peer))),
  };
};

/** The turn the session waits on, and since when; none once it waits on no one. */
const stallOf = (session: Live, at: number): Live['stalled'] => {
  if (Lockstep.waitingOn(session.lockstep).length === 0) return Option.none();
  const turn = session.lockstep.turn;
  const same = Option.filter(session.stalled, (stalled) => stalled.turn === turn);
  return Option.orElse(same, () => Option.some({ turn, since: at }));
};

/** Whether this peer, leading, has waited too long on others at the turn all wait on. */
const tooQuiet = (session: Live, at: number): boolean =>
  Lockstep.leaderAt(session.lockstep, session.lockstep.turn) === session.lockstep.self &&
  Option.exists(session.stalled, (stalled) => at - stalled.since >= quietMilliseconds);

/** As leader, peers held up on for too long are dropped from the turn all wait on. */
const dropQuiet = (model: Model, session: Live, at: number): AppReturn => {
  if (!tooQuiet(session, at)) return { model: live(model, session) };
  const { lockstep } = session;
  const quiet = Lockstep.waitingOn(lockstep).filter((peer) => peer !== lockstep.self);
  const dropped = quiet.reduce(
    (state, peer) => Lockstep.remove(state, peer, lockstep.turn),
    lockstep,
  );
  const next = settle(model, { _tag: 'Live', lockstep: dropped, stalled: Option.none() });
  return {
    model: next.model,
    commands: [
      ...quiet.map((peer) => say(model, { _tag: 'Drop', peer, until: lockstep.turn })),
      ...(next.commands ?? []),
    ],
  };
};

/**
 * A record to replay: no session, every throw and rebuild in the timeline at its step, and
 * the record's checks waiting to be compared as the world reaches them. The frontier
 * moves on a turn's steps each tick, so the game plays back at the pace it was played.
 */
const replayFrom = (model: Model, record: Record): Model => ({
  ...model,
  timeline: record.inputs.reduce(
    (timeline, { step, input }) => Timeline.schedule(timeline, step, input),
    Timeline.make<Play>(0),
  ),
  awaiting: record.checks,
  replay: Option.some({ until: record.until, checks: record.checks.length }),
});

/** A replay's tick: the world may go a turn further, as far as the record does. */
const replayTick = (model: Model, until: number): Model => ({
  ...model,
  timeline: Timeline.extend(
    model.timeline,
    Math.min(until, model.timeline.frontier + stepsPerTurn),
  ),
});

/** A turn's tick: this peer's packet out, what is complete applied, the quiet dropped. */
const tick = (model: Model, at: number): AppReturn => {
  if (Option.isSome(model.replay)) return { model: replayTick(model, model.replay.value.until) };
  if (model.session._tag !== 'Live') return { model };
  const sent = Lockstep.send(model.session.lockstep);
  const settled = settle(model, { ...model.session, lockstep: sent.state });
  const session = settled.model.session;
  const dropped =
    session._tag === 'Live'
      ? dropQuiet(settled.model, { ...session, stalled: stallOf(session, at) }, at)
      : settled;
  return {
    model: dropped.model,
    commands: [
      ...(sent.packet === undefined ? [] : [say(model, { _tag: 'Turn', packet: sent.packet })]),
      ...(settled.commands ?? []),
      ...(dropped.commands ?? []),
    ],
  };
};

/**
 * A session of one, from the turn this peer's world has been allowed to: its world goes
 * on from where it is.
 */
const alone = (model: Model, self: string): Model => {
  const turn = model.timeline.frontier / stepsPerTurn;
  const lockstep = Lockstep.join<Input>(self, {
    turn,
    lead,
    members: [{ peer: self, from: turn, until: null }],
  });
  return live(model, { _tag: 'Live', lockstep, stalled: Option.none() });
};

/** Says hello, and waits to be welcomed. */
const hello = (model: Model, peer: string): AppReturn => ({
  model,
  commands: [say(model, { _tag: 'Hello', peer }), WaitForWelcome()],
});

/**
 * This peer named: it joins, saying hello at once over the channel, or once the relay
 * the page names is open (`connected`).
 */
const named = (model: Model, peer: string, relay: Option.Option<string>): AppReturn => {
  const joining: Model = {
    ...model,
    away: false,
    session: { _tag: 'Joining', self: peer, heard: [] },
    relay: Option.map(relay, (url) => ({ url, link: 'Connecting' as const })),
  };
  return Option.isSome(relay) ? { model: joining } : hello(joining, peer);
};

const linked = (model: Model, link: Relay['link']): Model => ({
  ...model,
  relay: Option.map(model.relay, (relay) => ({ ...relay, link })),
});

/** The relay open: this peer says hello through it. */
const connected = (model: Model): AppReturn =>
  model.session._tag === 'Joining'
    ? hello(linked(model, 'Open'), model.session.self)
    : { model: linked(model, 'Open') };

/** The relay unreachable, or gone: this peer plays on alone, its world as it is. */
const lost = (model: Model): Model => {
  if (!Option.exists(model.relay, (relay) => relay.link !== 'Lost')) return model;
  const unlinked = linked(model, 'Lost');
  return Option.match(selfOf(model.session), {
    onNone: () => unlinked,
    onSome: (self) => alone(unlinked, self),
  });
};

/** Reconnecting: a new name, so this peer joins through the relay again as a newcomer. */
const reconnect = (model: Model): AppReturn =>
  Option.exists(model.relay, (relay) => relay.link === 'Lost')
    ? { model, commands: [NameTab()] }
    : { model };

/** No welcome came: this peer starts a session of its own, its world as it is. */
const waited = (model: Model): Model =>
  model.session._tag === 'Joining' ? alone(model, model.session.self) : model;

/**
 * Whether this peer can take a welcome: still joining, or (the welcome came just after it
 * gave up waiting) in a session of its own that no one else is in.
 */
const welcomable = (session: Model['session'], to: string): boolean => {
  if (session._tag === 'Joining') return session.self === to;
  if (session._tag !== 'Live') return false;
  const { lockstep } = session;
  return lockstep.self === to && Lockstep.membersAt(lockstep, lockstep.turn).length === 1;
};

const heardWhileJoining = (session: Model['session']) =>
  session._tag === 'Joining' ? session.heard : [];

/**
 * Welcomed: this peer joins the session, and a new run of its world replays every throw
 * so far from step 0, catching up to the session's turn.
 */
const welcomed = (model: Model, wire: Extract<Wire, { readonly _tag: 'Welcome' }>): AppReturn => {
  if (!welcomable(model.session, wire.to)) return { model };
  const lockstep = Lockstep.join(wire.to, wire, heardWhileJoining(model.session));
  const start = wire.turn * stepsPerTurn;
  const record = wire.record.reduce(
    (timeline, { step, input }) => Timeline.schedule(timeline, step, input),
    Timeline.make<Play>(start),
  );
  const replaying: Model = {
    ...fresh,
    paint: model.paint,
    relay: model.relay,
    run: model.run + 1,
    timeline: record,
    checksFrom: start,
  };
  return settle(replaying, { _tag: 'Live', lockstep, stalled: Option.none() });
};

/** A Hello: the leader admits the newcomer in its next packet. */
const helloed = (model: Model, peer: string): AppReturn =>
  model.session._tag === 'Live'
    ? {
        model: live(model, {
          ...model.session,
          lockstep: Lockstep.admit(model.session.lockstep, peer),
        }),
      }
    : { model };

/** A turn packet: kept while joining, received (and what it completes applied) once in. */
const turned = (model: Model, packet: Packet): AppReturn =>
  Match.valueTags(model.session, {
    Offline: () => ({ model }),
    Joining: (session) => ({
      model: { ...model, session: { ...session, heard: [...session.heard, packet] } },
    }),
    Live: (session) =>
      settle(model, { ...session, lockstep: Lockstep.receive(session.lockstep, packet) }),
  });

/** A peer gone, by its own goodbye or the leader's drop: no one waits for it from `until`. */
const gone = (model: Model, peer: string, until: number): AppReturn =>
  model.session._tag === 'Live'
    ? settle(model, {
        ...model.session,
        lockstep: Lockstep.remove(model.session.lockstep, peer, until),
      })
    : { model };

/** What another peer said, as this peer's session stands. */
const hear = (model: Model, wire: Wire): AppReturn =>
  Match.valueTags(wire, {
    Hello: ({ peer }) => helloed(model, peer),
    Turn: ({ packet }) => turned(model, packet),
    Welcome: (welcoming) => welcomed(model, welcoming),
    Bye: ({ peer, until }) => gone(model, peer, until),
    Drop: ({ peer, until }) => gone(model, peer, until),
  });

/** Leaving: the others stop waiting after the last turn this peer sent. */
const bye = (model: Model): AppReturn =>
  model.session._tag === 'Live'
    ? {
        model,
        commands: [
          say(model, {
            _tag: 'Bye',
            peer: model.session.lockstep.self,
            until: Lockstep.leave(model.session.lockstep) + 1,
          }),
        ],
      }
    : { model };

const others = (session: Live): number =>
  Lockstep.membersAt(session.lockstep, session.lockstep.turn).length - 1;

/**
 * Hidden with others in the session: this peer steps out, as its timers will crawl. Shown
 * again after stepping out: it joins again, as a newcomer.
 */
const changedVisibility = (model: Model, hidden: boolean): AppReturn => {
  if (hidden && model.session._tag === 'Live' && others(model.session) > 0) {
    const left = bye(model);
    return {
      model: { ...linked(model, 'Lost'), session: { _tag: 'Offline' }, away: true },
      commands: left.commands ?? [],
    };
  }
  return !hidden && model.away ? { model, commands: [NameTab()] } : { model };
};

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    ClickedTable: ({ point }) => ({ model: throwToward(model, point) }),
    ClickedRebuild: () => ({ model: propose(model, { _tag: 'Rebuild' }) }),
    ReachedStep: ({ run, step, checksum }) => ({ model: reach(model, run, step, checksum) }),
    ReceivedSceneLifecycle: () => ({ model }),
    NamedTab: ({ peer, relay, record }) =>
      Option.match(record, {
        onNone: () => named(model, peer, relay),
        onSome: (replaying) => ({ model: replayFrom(model, replaying) }),
      }),
    WaitedForWelcome: () => ({ model: waited(model) }),
    HeardWire: ({ wire }) => hear(model, wire),
    TickedTurn: ({ at }) => tick(model, at),
    LeftPage: () => bye(model),
    ChangedVisibility: ({ hidden }) => changedVisibility(model, hidden),
    CompletedSay: () => ({ model }),
    ConnectedRelay: () => connected(model),
    FailedRelay: () => ({ model: lost(model) }),
    LostRelay: () => ({ model: lost(model) }),
    ReleasedRelay: () => ({ model }),
    ClickedReconnect: () => reconnect(model),
  });
