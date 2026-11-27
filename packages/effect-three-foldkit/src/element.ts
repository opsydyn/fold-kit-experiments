/** The typed scene element and its mount outcome. */
import { UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { sceneEventSchemas } from '@opsydyn/effect-three/browser';
import { Schema } from 'effect';

export {
  domEventName,
  ReconciledDetail,
  SceneError,
  XrSessionDetail,
} from '@opsydyn/effect-three/browser';

/** Connects browser scene events to Effect UI without registering a custom element. */
export const sceneElement: Html.CustomElementBinding<
  'effect-three-scene',
  Record<never, never>,
  typeof sceneEventSchemas
> = Html.customElement({
  tag: 'effect-three-scene',
  events: sceneEventSchemas,
});

/** Outcome of mounting a scene. Map it into the app's messages with Mount.map. */
export const SceneLifecycle = UiSchema.TaggedEnum({
  StartedScene: {},
  FailedScene: { reason: Schema.String },
});
export type SceneLifecycle = typeof SceneLifecycle.Type;
