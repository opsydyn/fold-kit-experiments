import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  HoveredBuilding: { instance: Schema.String },
  LeftCity: {},
  ClickedBuilding: { instance: Schema.String },
  ClickedNewCity: {},
  ChangedPerformance: { fps: Schema.Number, factor: Schema.Number },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
