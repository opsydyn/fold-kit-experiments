import type { Command } from '@effect/ui';
import { type Gesture, glided, orbit, orbitOptions, type Vec3 } from '@opsydyn/effect-three';
import { Match, Option, Struct } from 'effect';

import { CheckVr, EnterVr, ExitVr } from './command';
import type { Message } from './message';
import { homeCamera, initialModel, type Model, mostMarbles, pour, toyAt, type Toy } from './model';

type AppReturn = {
  readonly model: Model;
  readonly commands?: ReadonlyArray<Command.Command<Message, CheckVr | EnterVr | ExitVr>>;
};

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

export const init = () => ({ model: initialModel });

const vrAvailability = { true: 'ready', false: 'unavailable' } as const;
const vrSession = { true: 'presenting', false: 'ready' } as const;

export const update = (model: Model, message: Message): AppReturn =>
  Match.value(message).pipe(
    Match.withReturnType<AppReturn>(),
    Match.tagsExhaustive({
      ClickedToy: ({ key, direction }) => ({ model: kick(model, key, direction) }),
      ClickedDrop: () => ({ model: dropped(model) }),
      ClickedTidy: () => ({ model: tidied(model) }),
      ToggledColliders: () => ({
        model: Struct.evolve(model, { showColliders: (shown) => !shown }),
      }),
      ClickedPour: () => ({
        model: Struct.evolve(model, {
          marbles: (marbles) => Math.min(mostMarbles, marbles + pour),
        }),
      }),
      Bumped: ({ started, marble }) => ({
        // Toys bumping into things; marbles roll in and out of contact all the time.
        model: Struct.evolve(model, { bumps: (bumps) => bumps + Number(started && !marble) }),
      }),
      MadeGesture: ({ gesture }) => ({ model: orbited(model, gesture) }),
      CheckedVr: ({ supported }) => ({
        model: Struct.evolve(model, { vr: () => vrAvailability[`${supported}`] }),
      }),
      ClickedEnterVr: () => ({
        model: Struct.evolve(model, { vr: () => 'entering' as const }),
        commands: [EnterVr.make()],
      }),
      ClickedExitVr: () => ({ model, commands: [ExitVr.make()] }),
      FailedVr: () => ({ model: Struct.evolve(model, { vr: () => 'ready' as const }) }),
      ChangedVrSession: ({ presenting }) => ({
        model: Struct.evolve(model, { vr: () => vrSession[`${presenting}`] }),
      }),
      // The session glides the player with the sticks (pmndrs/xr's controller locomotion);
      // when they let go, the Model keeps where they stand.
      Glided: ({ moved }) => ({
        model: Struct.evolve(model, { player: (player) => glided(player, moved) }),
      }),
      ReceivedSceneLifecycle: ({ lifecycle }) =>
        lifecycle._tag === 'StartedScene'
          ? { model, commands: [CheckVr.make()] }
          : { model: Struct.assign(model, { sceneFailure: lifecycle.reason }) },
    }),
  );

export { homeCamera };
