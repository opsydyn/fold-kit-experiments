import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Series, Theme } from './model';

export const Message = defineMessageUnion({
  HoveredBar: { key: Schema.String },
  LeftBar: { key: Schema.String },
  ClickedBar: { key: Schema.String },
  DoubleClickedBar: { key: Schema.String },
  ClickedEmptySpace: {},
  ClickedNewData: {},
  ClickedOrder: {},
  ClickedSeries: { series: Series },
  ChangedTheme: { theme: Theme },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
