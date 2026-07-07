import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as HistogramMessage } from '../../ui/histogram-chart';

export const GotHistogramMessage = m('GotHistogramMessage', { message: Schema.Unknown });
export type GotHistogramMessage = Omit<typeof GotHistogramMessage.Type, 'message'> & {
  readonly message: HistogramMessage;
};

export const Message = Schema.Union([GotHistogramMessage]);
export type Message = typeof Message.Type;
