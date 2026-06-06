import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as HistogramMessage } from '../../ui/histogram-chart';
import type { Message as ScatterMessage } from '../../ui/scatter-chart';

export const GotHistogramMessage = m('GotHistogramMessage', { inner: Schema.Unknown });
export type GotHistogramMessage = Omit<typeof GotHistogramMessage.Type, 'inner'> & {
  readonly inner: HistogramMessage;
};

export const GotScatterMessage = m('GotScatterMessage', { inner: Schema.Unknown });
export type GotScatterMessage = Omit<typeof GotScatterMessage.Type, 'inner'> & {
  readonly inner: ScatterMessage;
};

export const Message = Schema.Union([GotHistogramMessage, GotScatterMessage]);
export type Message = typeof Message.Type;
