import {
  autoRotated,
  type BodyCollision,
  type Gesture,
  orbit,
  orbitOptions,
} from '@opsydyn/effect-three';
import { Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { Message } from './message';
import {
  type Bin,
  type Colour,
  initialModel,
  type Model,
  mostOfOne,
  pour,
  wheelSpeeds,
} from './model';

type AppReturn = Return<Model, Message>;

/** The instances node holding one colour's marbles this round. */
export const marblesKey = (model: Model, colour: Colour): string =>
  `marbles:${colour}:${model.round}`;

const bins: ReadonlyArray<Bin> = ['gold-bin', 'teal-bin'];

/** The marble colour a node key names, this round. */
const colourOf = (model: Model, key: string): Option.Option<Colour> =>
  Option.fromNullishOr(
    (['gold', 'teal'] as const).find((colour) => key === marblesKey(model, colour)),
  );

/** The bin a collision's part names, on either side. */
const binOf = (collision: BodyCollision): Option.Option<Bin> =>
  Option.fromNullishOr(bins.find((bin) => collision.aPart === bin || collision.bPart === bin));

/** A marble starting to touch a bin's sensor has dropped into it: count it by colour. */
const binned = (model: Model, collision: BodyCollision): Model => {
  if (!collision.started) return model;
  const colour = Option.orElse(colourOf(model, collision.a), () => colourOf(model, collision.b));
  return Option.match(Option.all({ bin: binOf(collision), colour }), {
    onNone: () => model,
    onSome: ({ bin, colour: which }) => {
      const field = bin === 'gold-bin' ? 'goldBin' : 'tealBin';
      return { ...model, [field]: { ...model[field], [which]: model[field][which] + 1 } };
    },
  });
};

const poured = (model: Model, colour: Colour): Model => ({
  ...model,
  poured: { ...model.poured, [colour]: Math.min(mostOfOne, model.poured[colour] + pour) },
});

/** A new round: every marble gets a new key, so the machine empties and pours again. */
const emptied = (model: Model): Model => ({
  ...initialModel(model.assetBase),
  round: model.round + 1,
  wheelSpeed: model.wheelSpeed,
  showColliders: model.showColliders,
  camera: model.camera,
});

/** The wheel a step faster or slower, keeping its direction, within its range. */
const geared = (model: Model, factor: number): Model => {
  const size = Math.abs(model.wheelSpeed) * factor;
  const clamped = Math.min(wheelSpeeds.fastest, Math.max(wheelSpeeds.slowest, size));
  return { ...model, wheelSpeed: Math.sign(model.wheelSpeed || -1) * clamped };
};

const orbitLimits = orbitOptions({ minDistance: 5, maxDistance: 18 });

/** Orbit unless the gesture began on something (nothing here is clickable, but be safe). */
const orbited = (model: Model, gesture: Gesture): Model =>
  'key' in gesture && gesture.key !== undefined
    ? model
    : { ...model, camera: orbit(model.camera, gesture, orbitLimits) };

export const init = (props: { readonly assetBase?: string } = {}) => ({
  model: initialModel(props.assetBase ?? '/models/'),
});

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    ClickedPour: ({ colour }) => ({ model: poured(model, colour) }),
    ClickedEmpty: () => ({ model: emptied(model) }),
    ClickedFaster: () => ({ model: geared(model, 1.5) }),
    ClickedSlower: () => ({ model: geared(model, 1 / 1.5) }),
    ClickedReverse: () => ({
      model: modifyFields(model, { wheelSpeed: (speed) => -speed }),
    }),
    ToggledColliders: () => ({
      model: modifyFields(model, { showColliders: (shown) => !shown }),
    }),
    Collided: ({ collision }) => ({ model: binned(model, collision) }),
    KnockedWheel: ({ force }) => ({
      model: modifyFields(model, {
        knocks: (knocks) => knocks + 1,
        hardest: (hardest) => Math.max(hardest, force),
      }),
    }),
    MadeGesture: ({ gesture }) => ({ model: orbited(model, gesture) }),
    // The camera turned by itself; keep where it got to, so the gesture after goes on from there.
    AutoRotated: ({ turned }) => ({
      model: modifyFields(model, { camera: (camera) => autoRotated(camera, turned) }),
    }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
