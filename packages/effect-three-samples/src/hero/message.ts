import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

export const Message = UiSchema.TaggedEnum({
  ClickedCube: { index: Schema.Int },
  HoveredCube: { index: Schema.Int },
  LeftCube: { index: Schema.Int },
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;

/** Cube keys are `cube-<index>`; anything else is not a cube. */
export const cubeIndex = (key: string): number => Number.parseInt(key.replace('cube-', ''), 10);
