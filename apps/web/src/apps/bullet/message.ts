import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BulletMessage } from '../../ui/bullet-chart';

export const Message = defineMessageUnion({
  GotBulletMessage: { message: Schema.Unknown },
});
export type GotBulletMessage = Omit<typeof Message.GotBulletMessage.Type, 'message'> & {
  readonly message: BulletMessage;
};
export type Message = typeof Message.Type;
