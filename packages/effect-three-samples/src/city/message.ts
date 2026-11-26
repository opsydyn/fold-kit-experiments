import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

export const Message = UiSchema.TaggedEnum({
  HoveredBuilding: { instance: Schema.String },
  LeftCity: {},
  ClickedBuilding: { instance: Schema.String },
  ClickedNewCity: {},
  ChangedPerformance: { fps: Schema.Number, factor: Schema.Number },
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
