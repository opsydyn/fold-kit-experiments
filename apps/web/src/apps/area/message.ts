import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as AreaMessage } from '../../ui/area-chart';

export const Message = defineMessageUnion({
  GotAreaMessage: { message: Schema.Unknown },
});
export type GotAreaMessage = Omit<typeof Message.GotAreaMessage.Type, 'message'> & {
  readonly message: AreaMessage;
};
export type Message = typeof Message.Type;
