/**
 * The headless example's scene in a Foldkit app: copy this beside
 * `headless/src/scene.ts` into an application with `@opsydyn/effect-three-foldkit`,
 * FoldKit 0.167.x and Effect 4.0.0 installed. Clicks select crates; drags, the wheel and
 * pinches orbit a camera the Model keeps.
 */
import {
  type Camera,
  type Gesture,
  orbit,
  perspectiveCamera,
  SceneSchema,
} from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

import { clicked, model as crates, type Model as Crates, sceneFor } from './scene.js';

// Once per application: the environment owns renderers, assets and engines.
const environment = EffectThreeFoldkit.makeEnvironment(window);
const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);

export const Message = defineMessageUnion({
  ClickedCrate: { key: Schema.String },
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;

export type Model = { readonly crates: Crates; readonly camera: Camera };

export const init = (): Return<Model, Message> => ({
  model: { crates, camera: perspectiveCamera({ position: [0, 2, 6], damping: 0.1 }) },
});

/** A gesture that began on a crate (it carries the crate's key) is a click, not an orbit. */
const orbits = (gesture: Gesture): boolean => !('key' in gesture && gesture.key !== undefined);

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match<Return<Model, Message>>(message, {
    ClickedCrate: ({ key }) => ({ model: { ...model, crates: clicked(model.crates, key) } }),
    MadeGesture: ({ gesture }) => ({
      model: orbits(gesture) ? { ...model, camera: orbit(model.camera, gesture) } : model,
    }),
    ReceivedSceneLifecycle: () => ({ model }),
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Crates',
  body: EffectThreeFoldkit.view(
    {
      // The scene claims gestures, and its camera is the Model's.
      scene: { ...sceneFor(model.crates), camera: model.camera, gestures: 'scene' },
      mount: sceneMount,
      className: 'scene', // give it a size in CSS
      onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
      onClick: ({ key }) => Message.ClickedCrate({ key }),
      onGesture: (gesture) => Message.MadeGesture({ gesture }),
    },
    h,
  ),
});
