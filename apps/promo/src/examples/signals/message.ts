import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { ChartRole } from './model';
const pointer = { role: ChartRole, pointerId: Schema.Number, x: Schema.Number, y: Schema.Number };
export const Message = defineMessageUnion({
  ClickedFreshnessScenario: { scenario: Schema.Literals(['Fresh', 'Stale']) },
  ChangedSignalDataset: { props: Schema.Unknown },
  RecordedChartWidth: { role: ChartRole, width: Schema.Number },
  RecordedInputAvailability: { role: ChartRole, status: Schema.Literals(['Ready', 'Unavailable']) },
  RecordedPointerPosition: pointer,
  StartedChartPointer: pointer,
  MovedChartPointer: pointer,
  EndedChartPointer: pointer,
  CancelledChartPointer: { role: ChartRole, pointerId: Schema.Number },
  ChangedRangeStart: { index: Schema.Number },
  ChangedRangeEnd: { index: Schema.Number },
  ClickedZoomIn: {},
  ClickedZoomOut: {},
  ClickedResetView: {},
  ClickedClearSelection: {},
  ClickedPinInspection: {},
  ClickedResumeInspection: {},
  PressedInspectionKey: {
    role: ChartRole,
    key: Schema.Literals(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape']),
  },
});
export type Message = typeof Message.Type;

export type ChangedSignalDataset = Omit<typeof Message.ChangedSignalDataset.Type, 'props'> & {
  readonly props: import('./quality').Props;
};
