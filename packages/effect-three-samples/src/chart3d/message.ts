import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { defineMessageUnion } from 'foldkit/message';

import { Chart, Theme } from './model';

export const Message = defineMessageUnion({
  ClickedChart: { chart: Chart },
  ClickedResetView: {},
  MadeGesture: { gesture: SceneSchema.Gesture },
  ChangedTheme: { theme: Theme },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
