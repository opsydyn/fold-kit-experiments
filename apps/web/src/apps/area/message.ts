import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as AreaMessage } from '../../ui/area-chart';

export const Message = defineMessageUnion({
  ReceivedAreaMessage: { message: Schema.Unknown },
});
export type ReceivedAreaMessage = Omit<typeof Message.ReceivedAreaMessage.Type, 'message'> & {
  readonly message: AreaMessage;
};
export type Message = typeof Message.Type;
