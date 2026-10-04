import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as WaterfallMessage } from '../../ui/waterfall-chart';

export const Message = defineMessageUnion({
  ReceivedWaterfallMessage: { message: Schema.Unknown },
});
export type ReceivedWaterfallMessage = Omit<
  typeof Message.ReceivedWaterfallMessage.Type,
  'message'
> & {
  readonly message: WaterfallMessage;
};
export type Message = typeof Message.Type;
