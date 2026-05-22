import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as WaterfallMessage } from '../../ui/waterfall-chart';

export const GotWaterfallMessage = m('GotWaterfallMessage', { inner: Schema.Unknown });
export type GotWaterfallMessage = Omit<typeof GotWaterfallMessage.Type, 'inner'> & {
  readonly inner: WaterfallMessage;
};

export const Message = Schema.Union([GotWaterfallMessage]);
export type Message = typeof Message.Type;
