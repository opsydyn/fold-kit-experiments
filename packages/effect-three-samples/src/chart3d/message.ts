import { UiSchema } from '@effect/ui';
import { SceneSchema } from '@opsydyn/effect-three';

import { SceneStart } from '../effect-ui-scene';
import { Chart, Theme } from './model';

export const Message = UiSchema.TaggedEnum({
  ClickedChart: { chart: Chart },
  ClickedResetView: {},
  MadeGesture: { gesture: SceneSchema.Gesture },
  ChangedTheme: { theme: Theme },
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
