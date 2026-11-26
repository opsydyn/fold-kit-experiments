import { UiSchema } from '@effect/ui';
import { ReconciledDetail } from '@opsydyn/effect-three-foldkit/browser';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

export const Message = UiSchema.TaggedEnum({
  ClickedAdd: {},
  ClickedMoveAcross: {},
  ClickedRotate: {},
  ClickedRemove: {},
  ClickedCube: { key: Schema.String },
  HoveredCube: { key: Schema.String },
  LeftCube: { key: Schema.String },
  ReceivedReconciled: { detail: ReconciledDetail },
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
