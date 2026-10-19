import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Vec3 } from './model';

export const Message = defineMessageUnion({
  PressedHandle: { key: Schema.String, origin: Vec3, direction: Vec3 },
  DraggedHandle: { key: Schema.String, origin: Vec3, direction: Vec3 },
  DroppedHandle: {},
  ClickedDashes: {},
  ClickedGlitter: {},
  ClickedReset: {},
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
