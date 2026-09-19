import { Schema } from 'effect';
import { Command, Port } from 'foldkit';
import { defineTaggedUnion } from 'foldkit/schema';

import { Point } from '../request-diagnostics/model';
import { NavigationValue } from '../request-diagnostics/navigation';

export const ReplayEvent = defineTaggedUnion({
  LoadedMetrics: { points: Schema.Array(Point) },
  StartedSelection: {},
  ChangedSelection: { domain: Schema.Tuple([Schema.Number, Schema.Number]) },
  ClearedSelection: {},
  ClickedReload: {},
  CompletedCancelFetchMetrics: { outcome: Command.Interruptible.Outcome },
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

export const ReplayEventPort = Port.inbound(ReplayEvent);
export const TransitionTelemetryPort = Port.outbound(TransitionRecorded);
