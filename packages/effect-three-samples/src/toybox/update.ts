import { type Gesture, orbit, orbitOptions, type Vec3 } from '@opsydyn/effect-three';
import { Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { Message } from './message';
import { homeCamera, type Model, toyAt, type Toy } from './model';

type AppReturn = Return<Model, Message>;

export const toyKey = (model: Model, toy: Toy): string => `toy:${model.round}:${toy.id}`;

/** The toy a scene key names, in this round. */
const toyOf = (model: Model, key: string): Option.Option<Toy> =>
  Option.fromNullishOr(model.toys.find((toy) => toyKey(model, toy) === key));

/**
 * A kick away from the camera and up: the click's ray, flattened, plus a lift. The toys
 * weigh one unit, so this is also the change in velocity.
 */
const kickAlong = (direction: Vec3): Vec3 => {
  const length = Math.hypot(direction[0], direction[2]) || 1;
  return [(direction[0] / length) * 2.5, 5, (direction[2] / length) * 2.5];
};

const kicked = (toy: Toy, direction: Vec3): Toy => ({
  ...toy,
  kick: { id: (toy.kick?.id ?? 0) + 1, impulse: kickAlong(direction) },
});

const kick = (model: Model, key: string, direction: Vec3): Model =>
  Option.match(toyOf(model, key), {
    onNone: () => model,
    onSome: (target) => ({
      ...model,
      toys: model.toys.map((toy) => (toy.id === target.id ? kicked(toy, direction) : toy)),
    }),
  });

/** Most toys a box holds before the oldest goes. */
const capacity = 24;

const dropped = (model: Model): Model => ({
  ...model,
  toys: [...model.toys, toyAt(model.nextId)].slice(-capacity),
  nextId: model.nextId + 1,
});

/** Every toy back on its drop point: a new round, so each one drops afresh. */
const tidied = (model: Model): Model => ({
  ...model,
  toys: model.toys.map((toy) => ({ ...toyAt(toy.id), kick: null })),
  round: model.round + 1,
});

const orbitLimits = orbitOptions({
  maxPolarAngle: Math.PI / 2 - 0.1,
  minDistance: 4,
  maxDistance: 18,
});

/** Orbit unless the gesture began on a toy (a click on it is a kick). */
const orbited = (model: Model, gesture: Gesture): Model =>
  'key' in gesture && gesture.key !== undefined
    ? model
    : { ...model, camera: orbit(model.camera, gesture, orbitLimits) };

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    ClickedToy: ({ key, direction }) => ({ model: kick(model, key, direction) }),
    ClickedDrop: () => ({ model: dropped(model) }),
    ClickedTidy: () => ({ model: tidied(model) }),
    Bumped: () => ({ model: modifyFields(model, { bumps: (bumps) => bumps + 1 }) }),
    MadeGesture: ({ gesture }) => ({ model: orbited(model, gesture) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });

export { homeCamera };
