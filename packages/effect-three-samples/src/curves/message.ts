import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';
import { Vec3 } from './model';

export const Message = UiSchema.TaggedEnum({
  PressedHandle: { key: Schema.String, origin: Vec3, direction: Vec3 },
  DraggedHandle: { key: Schema.String, origin: Vec3, direction: Vec3 },
  DroppedHandle: {},
  ClickedDashes: {},
  ClickedGlitter: {},
  ClickedReset: {},
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
