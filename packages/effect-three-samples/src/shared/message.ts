import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

export const Message = UiSchema.TaggedEnum({
  ClickedCube: { key: Schema.String },
  HoveredCube: { key: Schema.String },
  LeftCube: { key: Schema.String },
  ClickedToggleSize: {},
  ClickedToggleSecondCube: {},
  ClickedToggleScene: {},
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
