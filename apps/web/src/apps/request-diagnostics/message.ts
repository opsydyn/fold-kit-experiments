import { Schema } from 'effect';
import { Command } from 'foldkit';
import { m } from 'foldkit/message';

import type { Message as HistogramMessage } from '../../ui/histogram-chart';
import type { Message as ScatterMessage } from '../../ui/scatter-chart';
import { Point } from './model';
import { NavigationValue } from './navigation';

export const ClickedReload = m('ClickedReload');
export const StartedSelection = m('StartedSelection');
export const ChangedSelection = m('ChangedSelection', {
  domain: Schema.Tuple([Schema.Number, Schema.Number]),
});
export const ClearedSelection = m('ClearedSelection');
export const LoadedMetrics = m('LoadedMetrics', { points: Schema.Array(Point) });
export const FailedLoad = m('FailedLoad', { error: Schema.String });
export const CompletedCancelFetchMetrics = m('CompletedCancelFetchMetrics', {
  outcome: Command.Interruptible.Outcome,
});
export const Navigated = m('Navigated', NavigationValue.fields);

export const GotHistogramMessage = m('GotHistogramMessage', { message: Schema.Unknown });
export type GotHistogramMessage = Omit<typeof GotHistogramMessage.Type, 'message'> & {
  readonly message: HistogramMessage;
};

export const GotScatterMessage = m('GotScatterMessage', { message: Schema.Unknown });
export type GotScatterMessage = Omit<typeof GotScatterMessage.Type, 'message'> & {
  readonly message: ScatterMessage;
};

export const Message = Schema.Union([
  ClickedReload,
  StartedSelection,
  ChangedSelection,
  ClearedSelection,
  LoadedMetrics,
  FailedLoad,
  CompletedCancelFetchMetrics,
  Navigated,
  GotHistogramMessage,
  GotScatterMessage,
]);
export type Message = typeof Message.Type;
