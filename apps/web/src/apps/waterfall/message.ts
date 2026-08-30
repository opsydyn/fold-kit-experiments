import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as WaterfallMessage } from '../../ui/waterfall-chart';

export const Message = defineMessageUnion({
  GotWaterfallMessage: { message: Schema.Unknown },
});
export type GotWaterfallMessage = Omit<typeof Message.GotWaterfallMessage.Type, 'message'> & {
  readonly message: WaterfallMessage;
};
export type Message = typeof Message.Type;
