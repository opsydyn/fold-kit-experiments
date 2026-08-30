import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ZChoroplethMessage } from '../../ui/zoomable-choropleth-map';

export const Message = defineMessageUnion({
  GotZChoroplethMessage: { message: Schema.Unknown },
});
export type GotZChoroplethMessage = Omit<typeof Message.GotZChoroplethMessage.Type, 'message'> & {
  readonly message: ZChoroplethMessage;
};
export type Message = typeof Message.Type;
