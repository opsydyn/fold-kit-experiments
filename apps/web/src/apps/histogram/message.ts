import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as HistogramMessage } from '../../ui/histogram-chart';

export const GotHistogramMessage = m('GotHistogramMessage', { inner: Schema.Unknown });
export type GotHistogramMessage = Omit<typeof GotHistogramMessage.Type, 'inner'> & {
  readonly inner: HistogramMessage;
};

export const Message = Schema.Union([GotHistogramMessage]);
export type Message = typeof Message.Type;
