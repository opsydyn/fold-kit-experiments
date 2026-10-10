import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Mode, Orientation } from './model';
export const Message = defineMessageUnion({
  SelectedMode: { mode: Mode },
  SelectedOrientation: { orientation: Orientation },
  SelectedPaint: { paint: Schema.Literals(['solid', 'dots', 'hatch', 'gradient']) },
  RecordedWidth: { width: Schema.Number },
  InspectedBar: { key: Schema.String },
  ClickedReset: {},
});
export type Message = typeof Message.Type;
