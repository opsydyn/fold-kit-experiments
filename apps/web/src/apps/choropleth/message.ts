import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ChoroplethMessage } from '../../ui/choropleth-map';

export const Message = defineMessageUnion({
  ReceivedChoroplethMessage: { message: Schema.Unknown },
});
export type ReceivedChoroplethMessage = Omit<
  typeof Message.ReceivedChoroplethMessage.Type,
  'message'
> & {
  readonly message: ChoroplethMessage;
};
export type Message = typeof Message.Type;
