/**
 * The `<effect-three-scene>` element: a typed `scene` property that Foldkit diffs on
 * every render, and Schema-decoded events that become the app's typed Messages.
 *
 * The tag is never registered with `customElements`; the scene Mount intercepts the
 * property instead (ADR-002), so there is nothing to re-register under HMR or SSR.
 *
 * @module
 */
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';
import { CustomElement } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';

import { sceneEventSchemas } from './sceneEvents.ts';

export { domEventName, ReconciledDetail, SceneError, XrSessionDetail } from './sceneEvents.ts';

export const sceneElement = CustomElement.define({
  tag: 'effect-three-scene',
  properties: { scene: SceneSchema.SceneDescription },
  events: sceneEventSchemas,
});

/** Outcome of mounting a scene. Map these into the app's Messages with `onLifecycle`. */
export const SceneLifecycle = defineMessageUnion({
  StartedScene: {},
  FailedScene: { reason: Schema.String },
});
export type SceneLifecycle = typeof SceneLifecycle.Type;
