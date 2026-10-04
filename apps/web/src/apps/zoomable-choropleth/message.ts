import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ZChoroplethMessage } from '../../ui/zoomable-choropleth-map';

export const Message = defineMessageUnion({
  ReceivedZChoroplethMessage: { message: Schema.Unknown },
});
export type ReceivedZChoroplethMessage = Omit<
  typeof Message.ReceivedZChoroplethMessage.Type,
  'message'
> & {
  readonly message: ZChoroplethMessage;
};
export type Message = typeof Message.Type;
