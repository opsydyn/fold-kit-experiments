import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as HistogramMessage } from '../../ui/histogram-chart';
import type { Message as ScatterMessage } from '../../ui/scatter-chart';

export const GotScatterMessage = m('GotScatterMessage', { message: Schema.Unknown });
export type GotScatterMessage = Omit<typeof GotScatterMessage.Type, 'message'> & {
  readonly message: ScatterMessage;
};

export const GotHistogramMessage = m('GotHistogramMessage', { message: Schema.Unknown });
export type GotHistogramMessage = Omit<typeof GotHistogramMessage.Type, 'message'> & {
  readonly message: HistogramMessage;
};

export const Message = Schema.Union([GotScatterMessage, GotHistogramMessage]);
export type Message = typeof Message.Type;
