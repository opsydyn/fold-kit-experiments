import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { Mode, Orientation, Paint } from './model';
export const Message = UiSchema.TaggedEnum({
  SelectedMode: { mode: Mode },
  SelectedOrientation: { orientation: Orientation },
  SelectedPaint: { paint: Paint },
  RecordedWidth: { width: Schema.Number },
  InspectedBar: { key: Schema.String },
  ClickedReset: {},
});
export type Message = typeof Message.Type;
