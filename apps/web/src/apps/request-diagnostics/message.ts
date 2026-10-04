import { Schema } from 'effect';
import { Command } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as HistogramMessage } from '../../ui/histogram-chart';
import type { Message as ScatterMessage } from '../../ui/scatter-chart';
import { Point } from './model';
import { NavigationValue } from './navigation';

export const Message = defineMessageUnion({
  ClickedReload: {},
  StartedSelection: {},
  ChangedSelection: {
    domain: Schema.Tuple([Schema.Number, Schema.Number]),
  },
  ClearedSelection: {},
  LoadedMetrics: { points: Schema.Array(Point) },
  FailedLoad: { error: Schema.String },
  CompletedCancelFetchMetrics: {
    outcome: Command.Interruptible.Outcome,
  },
  Navigated: NavigationValue.fields,
  ReceivedHistogramMessage: { message: Schema.Unknown },
  ReceivedScatterMessage: { message: Schema.Unknown },
});
export type ReceivedHistogramMessage = Omit<
  typeof Message.ReceivedHistogramMessage.Type,
  'message'
> & {
  readonly message: HistogramMessage;
};
export type ReceivedScatterMessage = Omit<typeof Message.ReceivedScatterMessage.Type, 'message'> & {
  readonly message: ScatterMessage;
};
export type Message = typeof Message.Type;
