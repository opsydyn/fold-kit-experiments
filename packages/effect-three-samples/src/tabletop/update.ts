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
  type Start,
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

/** Whether this peer leads its session now: it welcomes newcomers. */
const leads = (model: Model): boolean =>
  model.session._tag === 'Live' &&
  Lockstep.leaderAt(model.session.lockstep, model.session.lockstep.turn) ===
    model.session.lockstep.self;

/**
 * Where the world snapshots itself, for a newcomer to start from: a leader's at each
 * check step, where it stops anyway. Others take none.
 */
export const snapshotAtOf = (model: Model): number | null =>
  leads(model) ? nextCheck(model.timeline.reached, model.checksFrom) : null;

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

/** A snapshot of the world at `step`, kept with the table as it is there, inputs not yet due. */
const keep = (model: Model, step: number, snapshot: string | null): Model =>
  snapshot === null
    ? model
    : {
        ...model,
        kept: Option.some({
          step,
          snapshot,
          balls: model.balls,
          thrown: model.thrown,
          build: model.build,
        }),
      };

/**
 * The world reached `step` in this peer's run: a snapshot kept when it sends one, what is
 * due there, and a check when one is.
 */
const reach = (
  model: Model,
  run: number,
  step: number,
  checksum: string,
  snapshot: string | null,
): Model => {
  if (run !== model.run || model.timeline.reached === step) return model;
  const reached = deliver({
    ...remember(keep(model, step, snapshot), step),
    timeline: Timeline.reach(model.timeline, step),
    reached: Option.some({ step, checksum }),
  });
  return confirm(
    step % checkEvery === 0 && step >= model.checksFrom
      ? { ...reached, provisional: [...withoutStep(reached.provisional, step), { step, checksum }] }
      : reached,
  );
};

const withoutStep = <A extends { readonly step: number }>(
  list: ReadonlyArray<A>,
  step: number,
): ReadonlyArray<A> => list.filter((each) => each.step !== step);

/**
 * The step up to which the world's state is certain: every input before it is one the
 * session has applied. Without a session (a replay), every step is.
 */
const confirmedStep = (model: Model): number =>
  model.session._tag === 'Live'
    ? model.session.lockstep.turn * stepsPerTurn
    : Number.POSITIVE_INFINITY;

/**
 * This peer's checks whose step is confirmed: kept, compared and shared. A predicting
 * world reaches a check before the inputs before it are certain; one that never predicts
 * confirms each as it comes.
 */
const confirm = (model: Model): Model => {
  const certain = confirmedStep(model);
  const ready = model.provisional.filter((check) => check.step <= certain);
  const waiting: Model = {
    ...model,
    provisional: model.provisional.filter((check) => check.step > certain),
  };
  return ready.reduce<Model>((at, { step, checksum }) => checked(at, step, checksum), waiting);
};

// ROLLING BACK

/** Stops whose snapshots a predicting world keeps: enough to go back past any late input. */
export const keptStops = 12;

/** A predicting world's stop: the table there, before what was due, to come back to. */
const remember = (model: Model, step: number): Model =>
  model.predict
    ? {
        ...model,
        history: [
          ...withoutStep(model.history, step),
          { step, balls: model.balls, thrown: model.thrown, build: model.build },
        ].slice(-keptStops),
      }
    : model;

/**
 * The world goes back to its latest stop at or before `step` and on again: a new run
 * from the snapshot it kept there, with the table as it was, and what is due from there
 * on (an input that came late among it). What it reached after that stop is forgotten.
 */
const rollBack = (model: Model, step: number): Model => {
  const back = model.history.findLast((moment) => moment.step <= step) ?? model.history[0];
  if (back === undefined) return model;
  return {
    ...model,
    run: model.run + 1,
    start: Option.some({ step: back.step, snapshot: null }),
    timeline: pastStep(Timeline.restart(model.timeline), back.step),
    balls: back.balls,
    thrown: back.thrown,
    build: back.build,
    history: model.history.filter((moment) => moment.step <= back.step),
    provisional: model.provisional.filter((check) => check.step <= back.step),
    kept: Option.filter(model.kept, (kept) => kept.step <= back.step),
    rollbacks: model.rollbacks + 1,
  };
};

/** A turn confirmed: the Model with its plays in place, and the step to roll back to, if any. */
type Confirmed = { readonly model: Model; readonly late: number | undefined };

/** Whether two lists of plays are the same plays, in the same order. */
const samePlays = (a: ReadonlyArray<Play>, b: ReadonlyArray<Play>): boolean =>
  a.length === b.length && a.every((play, i) => play === b[i]);

/**
 * A predicting peer's applied turn: its plays, in the session's order, replace what was
 * scheduled at its step (this peer's own, scheduled when sent). The step that needs a
 * rollback, when they differ and the world may have passed it or had them delivered.
 */
const confirmTurn = (
  model: Model,
  step: number,
  plays: ReadonlyArray<Play>,
  passed: number,
): Confirmed => {
  const scheduled = model.timeline.inputs
    .filter((entry) => entry.step === step)
    .map((entry) => entry.input);
  if (samePlays(scheduled, plays)) return { model, late: undefined };
  const inputs = model.timeline.inputs.filter((entry) => entry.step !== step);
  const timeline = plays.reduce<Timeline.Timeline<Play>>(
    (at, play) => Timeline.schedule(at, step, play),
    { ...model.timeline, inputs },
  );
  return { model: { ...model, timeline }, late: step < passed ? step : undefined };
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

/**
 * The Welcome for `peer`: the session as it is, every throw so far, and the latest
 * snapshot of this peer's world to start from, when it has one.
 */
const welcome = (model: Model, lockstep: Lockstep.Lockstep<Input>, peer: string): Wire => {
  const base: Wire = {
    _tag: 'Welcome',
    to: peer,
    turn: lockstep.turn,
    lead: lockstep.lead,
    members: lockstep.members,
    record: model.timeline.inputs,
  };
  // A predicting leader's snapshot counts once the inputs before it are certain.
  const start = Option.getOrUndefined(
    Option.filter(model.kept, (kept) => kept.step <= confirmedStep(model)),
  );
  return start === undefined ? base : { ...base, start };
};

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
  const checked = result.applied.reduce(
    (at, { peer, input }) =>
      input._tag === 'Check' && peer !== self ? compare(at, input.step, input.checksum) : at,
    live(model, { ...session, lockstep: result.state }),
  );
  const applied = model.predict
    ? predicted(checked, result.applied, model)
    : result.applied.reduce(
        (at, { turn, input }) => (input._tag === 'Check' ? at : schedule(at, turn, input)),
        checked,
      );
  const settled = confirm(
    deliver({
      ...applied,
      timeline: Timeline.extend(applied.timeline, frontierOf(applied)),
    }),
  );
  const newcomers = Lockstep.welcomeDue(before, result.state);
  return {
    model: settled,
    commands: newcomers.map((peer) => say(settled, welcome(settled, result.state, peer))),
  };
};

/**
 * How far the world may go: a predicting peer's to the turn it sends next, others' to
 * the turn all have sent.
 */
const frontierOf = (model: Model): number =>
  model.session._tag !== 'Live'
    ? model.timeline.frontier
    : (model.predict ? model.session.lockstep.sent : model.session.lockstep.turn) * stepsPerTurn;

/**
 * A predicting peer's applied turns: each turn's plays confirmed at its step, and a
 * rollback to the earliest step its world may have passed (`before` is the Model the
 * world last heard: it is no further than where that one let it go).
 */
const predicted = (
  model: Model,
  applied: ReadonlyArray<Lockstep.Applied<Input>>,
  before: Model,
): Model => {
  const passed = Math.max(untilOf(before), (before.timeline.reached ?? -1) + 1);
  const turns = [...new Set(applied.map((entry) => entry.turn))];
  let late: number | undefined;
  let at = model;
  for (const turn of turns) {
    const plays = applied.flatMap((entry) =>
      entry.turn === turn && entry.input._tag !== 'Check' ? [entry.input] : [],
    );
    const confirmed = confirmTurn(at, turn * stepsPerTurn, plays, passed);
    at = confirmed.model;
    if (confirmed.late !== undefined && (late === undefined || confirmed.late < late)) {
      late = confirmed.late;
    }
  }
  return late === undefined ? at : rollBack(at, late);
};

/** This peer's own plays in a packet it sent, scheduled at once at its turn's step. */
const scheduleSent = (model: Model, packet: Packet | undefined): Model =>
  !model.predict || packet === undefined
    ? model
    : packet.entries.reduce(
        (at, entry) =>
          entry._tag === 'Input' && entry.input._tag !== 'Check'
            ? schedule(at, packet.turn, entry.input)
            : at,
        model,
      );

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
  const own = deliver(scheduleSent(model, sent.packet));
  const settled = settle(own, { ...model.session, lockstep: sent.state });
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
 * The timeline with what is due up to (not at) `step` taken as done: a world started from
 * a snapshot there holds it already.
 */
const pastStep = (timeline: Timeline.Timeline<Play>, step: number): Timeline.Timeline<Play> =>
  step === 0 ? timeline : Timeline.due(Timeline.reach(timeline, step - 1)).timeline;

/** A run that starts from the leader's snapshot, with the table as it was there. */
const startingFrom = (model: Model, start: Start): Model => ({
  ...model,
  timeline: pastStep(model.timeline, start.step),
  balls: start.balls,
  thrown: start.thrown,
  build: start.build,
  start: Option.some({ step: start.step, snapshot: start.snapshot }),
  // Where a predicting world can roll back to before its first stop.
  history: model.predict
    ? [{ step: start.step, balls: start.balls, thrown: start.thrown, build: start.build }]
    : [],
});

/**
 * Welcomed: this peer joins the session, and a new run of its world catches up to the
 * session's turn: from the leader's snapshot when the welcome brings one, replaying only
 * what came after it, or from step 0, replaying every throw so far.
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
    predict: model.predict,
    run: model.run + 1,
    timeline: record,
    checksFrom: start,
  };
  const starting = Option.match(Option.fromNullishOr(wire.start), {
    onNone: () => replaying,
    onSome: (from) => startingFrom(replaying, from),
  });
  return settle(starting, { _tag: 'Live', lockstep, stalled: Option.none() });
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

/** A tab named: it replays the record in its link, or joins the table live. */
const namedTab = (
  model: Model,
  peer: string,
  relay: Option.Option<string>,
  predict: boolean,
  record: Option.Option<Record>,
): AppReturn =>
  Option.match(record, {
    onNone: () => named({ ...model, predict }, peer, relay),
    onSome: (replaying) => ({ model: replayFrom(model, replaying) }),
  });

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    ClickedTable: ({ point }) => ({ model: throwToward(model, point) }),
    ClickedRebuild: () => ({ model: propose(model, { _tag: 'Rebuild' }) }),
    ReachedStep: ({ run, step, checksum, snapshot }) => ({
      model: reach(model, run, step, checksum, snapshot),
    }),
    ReceivedSceneLifecycle: () => ({ model }),
    NamedTab: ({ peer, relay, predict, record }) => namedTab(model, peer, relay, predict, record),
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
