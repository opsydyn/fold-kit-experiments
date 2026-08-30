import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ChoroplethMessage } from '../../ui/choropleth-map';

export const Message = defineMessageUnion({
  GotChoroplethMessage: { message: Schema.Unknown },
});
export type GotChoroplethMessage = Omit<typeof Message.GotChoroplethMessage.Type, 'message'> & {
  readonly message: ChoroplethMessage;
};
export type Message = typeof Message.Type;
