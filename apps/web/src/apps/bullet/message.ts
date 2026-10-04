import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BulletMessage } from '../../ui/bullet-chart';

export const Message = defineMessageUnion({
  ReceivedBulletMessage: { message: Schema.Unknown },
});
export type ReceivedBulletMessage = Omit<typeof Message.ReceivedBulletMessage.Type, 'message'> & {
  readonly message: BulletMessage;
};
export type Message = typeof Message.Type;
