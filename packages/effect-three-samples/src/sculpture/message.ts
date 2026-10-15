import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Paint } from '../palette';

export const Message = defineMessageUnion({
  ClickedSurface: { key: Schema.String, x: Schema.Number, z: Schema.Number },
  ClickedPaint: { paint: Paint },
  ChangedHistory: { shown: Schema.Int },
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedClear: {},
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
