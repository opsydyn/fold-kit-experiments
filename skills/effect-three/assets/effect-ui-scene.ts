/**
 * The headless example's scene in an Effect UI component: copy this beside
 * `headless/src/scene.ts` into an application with `@opsydyn/effect-three-foldkit`,
 * the pinned Effect UI snapshot and Effect installed. Clicks select crates; drags, the wheel and
 * pinches orbit a camera the Model keeps.
 */
import { Mount, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import {
  type Gesture,
  orbit,
  perspectiveCamera,
  SceneSchema,
} from '@opsydyn/effect-three';
import * as EffectThreeUi from '@opsydyn/effect-three-foldkit';
import { Effect, Schema } from 'effect';

import { clicked, model as crates, sceneFor } from './scene.js';

// Acquire the browser environment when the element mounts.
const environment = Effect.acquireRelease(
  Effect.sync(() => EffectThreeUi.makeEnvironment(window)),
  (created) => Effect.sync(created.dispose),
);
const sceneMount = EffectThreeUi.defineScopedSceneMount(environment);

export const Message = UiSchema.TaggedEnum({
  ClickedCrate: { key: Schema.String },
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeUi.SceneLifecycle },
});
export type Message = typeof Message.Type;

const Model = Schema.Struct({
  crates: Schema.Struct({
    crates: Schema.Array(Schema.Struct({ id: Schema.String, x: Schema.Number, colour: Schema.Number })),
    selected: Schema.NullOr(Schema.String),
  }),
  camera: SceneSchema.Camera,
});
type Model = typeof Model.Type;

/** A gesture that began on a crate (it carries the crate's key) is a click, not an orbit. */
const orbits = (gesture: Gesture): boolean => !('key' in gesture && gesture.key !== undefined);

export const App = Html.component({ name: 'Crates', model: Model, message: Message }).make({
  init: () => ({ crates, camera: perspectiveCamera({ position: [0, 2, 6], damping: 0.1 }) }),
  update: ({ model }, message) =>
    Message.match(message, {
      ClickedCrate: ({ key }) => ({ ...model, crates: clicked(model.crates, key) }),
      MadeGesture: ({ gesture }) =>
        orbits(gesture) ? { ...model, camera: orbit(model.camera, gesture) } : model,
      ReceivedSceneLifecycle: () => model,
    }),
  view: (h, model) =>
    EffectThreeUi.sceneElement(h)
      .class('scene') // give it a size in CSS
      .on('scene-click', ({ key }) => Message.ClickedCrate({ key }))
      .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
      .onMount(Mount.map(
        sceneMount({ scene: { ...sceneFor(model.crates), camera: model.camera, gestures: 'scene' } }),
        (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
      ))
      .children(),
});
