import { type BodyCollision, type Gesture, orbit, orbitOptions } from '@opsydyn/effect-three';
import { Option } from 'effect';
import type { Return } from 'foldkit/update';

import { RackRest, ReadFragment, SettleAfter } from './command';
import { Message } from './message';
import { initialModel, limits, type Model, pinIds } from './model';
import { decode, type Record } from './replay';
import { finished, freshRack } from './score';

type AppReturn = Return<Model, Message>;

export const pinKey = (model: Model, id: string): string => `pin:${model.rack}:${id}`;
/** The rolled ball: a fresh body, made with its impulse, so its roll has no history. */
export const ballKey = (model: Model): string => `ball:${model.shot}`;
/** The ball waiting at the line: only something to look at. */
export const readyBallKey = (model: Model): string => `ball:${model.shot}:ready`;

const clamp = (value: number, range: { readonly min: number; readonly max: number }) =>
  Math.min(range.max, Math.max(range.min, value));

/** The pin a node key names, in this rack. */
const pinOf = (model: Model, key: string): string | undefined =>
  pinIds.find((id) => key === pinKey(model, id));

/**
 * A pin's head reaching its own spot (`started`) means it stands; leaving it, that it is
 * down. A head crossing another pin's spot says nothing.
 */
const spotted = (model: Model, collision: BodyCollision): Model => {
  const sides = [
    { key: collision.a, part: collision.bPart },
    { key: collision.b, part: collision.aPart },
  ];
  const pin = sides
    .map(({ key, part }) => ({ id: pinOf(model, key), part }))
    .find(({ id, part }) => id !== undefined && part === `spot:${id}`)?.id;
  if (pin === undefined) return model;
  const others = model.standing.filter((id) => id !== pin);
  return { ...model, standing: collision.started ? [...others, pin] : others };
};

/** The ball reaching the pit: give the pins a moment to settle, then count. */
const pitted = (model: Model, collision: BodyCollision): AppReturn => {
  const ball = ballKey(model);
  const inPit =
    collision.started &&
    ((collision.a === ball && collision.bPart === 'pit') ||
      (collision.b === ball && collision.aPart === 'pit'));
  if (!inPit || model.phase !== 'rolling') return { model };
  return {
    model: { ...model, phase: 'settling' },
    commands: [SettleAfter({ shot: model.shot, seconds: 2.5 })],
  };
};

const collided = (model: Model, collision: BodyCollision): AppReturn =>
  pitted(spotted(model, collision), collision);

/**
 * Count the roll: the pins down are those standing before that no longer are. Then the
 * rack (fresh, or swept of the fallen) rests before the next roll may meet it.
 */
const counted = (model: Model): AppReturn => {
  const knocked = model.before.filter((id) => !model.standing.includes(id)).length;
  const rolls = [...model.rolls, knocked];
  const fresh = freshRack(rolls);
  const over = finished(rolls);
  const next: Model = {
    ...model,
    rolls,
    shot: model.shot + 1,
    rack: fresh ? model.rack + 1 : model.rack,
    standing: fresh ? [...pinIds] : model.standing.filter((id) => model.before.includes(id)),
    before: fresh ? [...pinIds] : model.standing.filter((id) => model.before.includes(id)),
    phase: over ? 'over' : 'racking',
  };
  return over ? { model: next } : { model: next, commands: [RackRest({ shot: next.shot })] };
};

/** A replay still has shots to roll. */
const replaying = (model: Model): boolean =>
  model.replay !== null && model.replay.rolled < model.replay.shots.length;

const rolled = (model: Model): AppReturn => {
  if (model.phase !== 'aiming') return { model };
  const shot = { aim: model.aim, angle: model.angle, speed: model.speed };
  return {
    model: {
      ...model,
      phase: 'rolling',
      before: model.standing,
      impact: 0,
      shots: [...model.shots, shot],
    },
    // If the ball never reaches the pit (it can stop in a gutter), count anyway.
    commands: [SettleAfter({ shot: model.shot, seconds: 7 })],
  };
};

const orbitLimits = orbitOptions({ minDistance: 2, maxDistance: 14, maxPolarAngle: 1.5 });

const orbited = (model: Model, gesture: Gesture): Model =>
  'key' in gesture && gesture.key !== undefined
    ? model
    : { ...model, camera: orbit(model.camera, gesture, orbitLimits) };

/** A new game: a fresh rack under new keys, the player's aim kept; it rests first. */
const newGame = (model: Model, replay: Record | null): AppReturn => {
  const next: Model = {
    ...initialModel(model.assetBase),
    rack: model.rack + 1,
    shot: model.shot + 1,
    aim: model.aim,
    angle: model.angle,
    speed: model.speed,
    layout: model.layout,
    camera: model.camera,
    replay: replay === null ? null : { ...replay, rolled: 0 },
  };
  return { model: next, commands: [RackRest({ shot: next.shot })] };
};

/** The rack has rested: rolling may begin, and a replay rolls its next shot at once. */
const rested = (model: Model): AppReturn => {
  const ready: Model = { ...model, phase: 'aiming' };
  const replay = ready.replay;
  const shot = replay?.shots[replay.rolled];
  if (replay === null || shot === undefined) return { model: ready };
  return rolled({ ...ready, ...shot, replay: { ...replay, rolled: replay.rolled + 1 } });
};

/** A replay link in the address starts that replay; anything else is left alone. */
const fromFragment = (model: Model, fragment: string): AppReturn =>
  Option.match(decode(fragment), {
    onNone: () => ({ model }),
    onSome: (record) => newGame(model, record),
  });

export const init = (props: { readonly assetBase?: string } = {}): AppReturn => ({
  model: initialModel(props.assetBase ?? '/models/'),
  commands: [ReadFragment(), RackRest({ shot: 0 })],
});

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    ChangedAim: ({ aim }) => ({ model: { ...model, aim: clamp(aim, limits.aim) } }),
    ChangedAngle: ({ angle }) => ({ model: { ...model, angle: clamp(angle, limits.angle) } }),
    ChangedSpeed: ({ speed }) => ({ model: { ...model, speed: clamp(speed, limits.speed) } }),
    // While a replay rolls, the player watches.
    ClickedRoll: () => (replaying(model) ? { model } : rolled(model)),
    ClickedNewGame: () => newGame(model, null),
    ClickedReplay: () =>
      model.shots.length === 0
        ? { model }
        : newGame(model, { shots: model.shots, rolls: model.rolls }),
    ReadFragment: ({ fragment }) => fromFragment(model, fragment),
    RackRested: ({ shot }) =>
      shot === model.shot && model.phase === 'racking' ? rested(model) : { model },
    Collided: ({ collision }) => collided(model, collision),
    Struck: ({ force }) => ({ model: { ...model, impact: Math.max(model.impact, force) } }),
    // Only the shot still in play is counted, once: a later or earlier timer is stale.
    Settled: ({ shot }) =>
      shot === model.shot && (model.phase === 'rolling' || model.phase === 'settling')
        ? counted(model)
        : { model },
    MeasuredScoreboard: ({ measured }) => ({ model: { ...model, layout: measured.block } }),
    MadeGesture: ({ gesture }) => ({ model: orbited(model, gesture) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
