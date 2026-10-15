import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  ClickedAdd: {},
  ClickedMoveAcross: {},
  ClickedRotate: {},
  ClickedRemove: {},
  ClickedCube: { key: Schema.String },
  HoveredCube: { key: Schema.String },
  LeftCube: { key: Schema.String },
  ReceivedReconciled: { detail: EffectThreeFoldkit.ReconciledDetail },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
