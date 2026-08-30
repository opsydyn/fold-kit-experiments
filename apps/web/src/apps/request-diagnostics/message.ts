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
  GotHistogramMessage: { message: Schema.Unknown },
  GotScatterMessage: { message: Schema.Unknown },
});
export type GotHistogramMessage = Omit<typeof Message.GotHistogramMessage.Type, 'message'> & {
  readonly message: HistogramMessage;
};
export type GotScatterMessage = Omit<typeof Message.GotScatterMessage.Type, 'message'> & {
  readonly message: ScatterMessage;
};
export type Message = typeof Message.Type;
