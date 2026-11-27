import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { Message as PlotPanelMessage } from '../../ui/plot-panel/core';
import { Point } from './model';
import { NavigationValue } from './navigation';

export const CancellationOutcome = UiSchema.TaggedEnum({
  Interrupted: {},
  NotFound: {},
});

export const Message = UiSchema.TaggedEnum({
  MountedDiagnostics: {},
  ClickedReload: {},
  StartedSelection: {},
  ChangedSelection: {
    domain: Schema.Tuple([Schema.Number, Schema.Number]),
  },
  ClearedSelection: {},
  LoadedMetrics: { points: Schema.Array(Point) },
  FailedLoad: { error: Schema.String },
  CompletedCancelFetchMetrics: {
    outcome: CancellationOutcome,
  },
  Navigated: NavigationValue.fields,
  ObservedRouteExit: { ...NavigationValue.fields, phase: Schema.Literal('exited') },
  ReceivedHistogramMessage: { message: PlotPanelMessage },
  ReceivedScatterMessage: { message: PlotPanelMessage },
  CompletedReportToObservatory: {},
});
export type Message = typeof Message.Type;
