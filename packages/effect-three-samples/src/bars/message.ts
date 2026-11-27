import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';
import { Series, Theme } from './model';

export const Message = UiSchema.TaggedEnum({
  HoveredBar: { key: Schema.String },
  LeftBar: { key: Schema.String },
  ClickedBar: { key: Schema.String },
  DoubleClickedBar: { key: Schema.String },
  ClickedEmptySpace: {},
  ClickedNewData: {},
  ClickedOrder: {},
  ClickedSeries: { series: Series },
  ChangedTheme: { theme: Theme },
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
