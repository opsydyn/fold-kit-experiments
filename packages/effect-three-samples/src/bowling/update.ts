import { type BodyCollision, type Gesture, orbit, orbitOptions } from '@opsydyn/effect-three';
import type { Return } from 'foldkit/update';

import { SettleAfter } from './command';
import { Message } from './message';
import { initialModel, limits, type Model, pinIds } from './model';
import { finished, freshRack } from './score';

type AppReturn = Return<Model, Message>;

export const pinKey = (model: Model, id: string): string => `pin:${model.rack}:${id}`;
export const ballKey = (model: Model): string => `ball:${model.shot}`;

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

/** Count the roll: the pins down are those standing before that no longer are. */
const counted = (model: Model): Model => {
  const knocked = model.before.filter((id) => !model.standing.includes(id)).length;
  const rolls = [...model.rolls, knocked];
  const fresh = freshRack(rolls);
  return {
    ...model,
    rolls,
    shot: model.shot + 1,
    rack: fresh ? model.rack + 1 : model.rack,
    standing: fresh ? [...pinIds] : model.standing.filter((id) => model.before.includes(id)),
    before: fresh ? [...pinIds] : model.standing.filter((id) => model.before.includes(id)),
    phase: finished(rolls) ? 'over' : 'aiming',
  };
};

const rolled = (model: Model): AppReturn => {
  if (model.phase !== 'aiming') return { model };
  return {
    model: { ...model, phase: 'rolling', before: model.standing, impact: 0 },
    // If the ball never reaches the pit (it can stop in a gutter), count anyway.
    commands: [SettleAfter({ shot: model.shot, seconds: 7 })],
  };
};

const orbitLimits = orbitOptions({ minDistance: 2, maxDistance: 14, maxPolarAngle: 1.5 });

const orbited = (model: Model, gesture: Gesture): Model =>
  'key' in gesture && gesture.key !== undefined
    ? model
    : { ...model, camera: orbit(model.camera, gesture, orbitLimits) };

export const init = (props: { readonly assetBase?: string } = {}) => ({
  model: initialModel(props.assetBase ?? '/models/'),
});

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    ChangedAim: ({ aim }) => ({ model: { ...model, aim: clamp(aim, limits.aim) } }),
    ChangedAngle: ({ angle }) => ({ model: { ...model, angle: clamp(angle, limits.angle) } }),
    ChangedSpeed: ({ speed }) => ({ model: { ...model, speed: clamp(speed, limits.speed) } }),
    ClickedRoll: () => rolled(model),
    ClickedNewGame: () => ({
      model: {
        ...initialModel(model.assetBase),
        rack: model.rack + 1,
        shot: model.shot + 1,
        aim: model.aim,
        angle: model.angle,
        speed: model.speed,
        layout: model.layout,
        camera: model.camera,
      },
    }),
    Collided: ({ collision }) => collided(model, collision),
    Struck: ({ force }) => ({ model: { ...model, impact: Math.max(model.impact, force) } }),
    // Only the shot still in play is counted, once: a later or earlier timer is stale.
    Settled: ({ shot }) => ({
      model:
        shot === model.shot && (model.phase === 'rolling' || model.phase === 'settling')
          ? counted(model)
          : model,
    }),
    MeasuredScoreboard: ({ measured }) => ({ model: { ...model, layout: measured.block } }),
    MadeGesture: ({ gesture }) => ({ model: orbited(model, gesture) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
