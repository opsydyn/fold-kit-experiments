import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  ClickedCube: { key: Schema.String },
  HoveredCube: { key: Schema.String },
  LeftCube: { key: Schema.String },
  ClickedToggleSize: {},
  ClickedToggleSecondCube: {},
  ClickedToggleScene: {},
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
