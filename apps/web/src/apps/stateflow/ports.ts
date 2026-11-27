import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { CancellationOutcome } from '../request-diagnostics/message';
import { Point } from '../request-diagnostics/model';
import { NavigationValue } from '../request-diagnostics/navigation';

export const ReplayEvent = UiSchema.TaggedEnum({
  LoadedMetrics: { points: Schema.Array(Point) },
  StartedSelection: {},
  ChangedSelection: { domain: Schema.Tuple([Schema.Number, Schema.Number]) },
  ClearedSelection: {},
  ClickedReload: {},
  CompletedCancelFetchMetrics: { outcome: CancellationOutcome },
  Navigated: NavigationValue.fields,
});
export type ReplayEvent = typeof ReplayEvent.Type;

export const TransitionRecorded = Schema.Struct({
  sequence: Schema.Number,
  messageTag: Schema.String,
  outcome: Schema.Literals(['transitioned', 'ignored']),
  from: Schema.String,
  target: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  commandNames: Schema.Array(Schema.String),
});
export type TransitionRecorded = typeof TransitionRecorded.Type;

export const replayEventName = 'stateflow:replay';
export const transitionTelemetryName = 'stateflow:transition';
