import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as BulletMessage } from '../../ui/bullet-chart';

export const GotBulletMessage = m('GotBulletMessage', { message: Schema.Unknown });
export type GotBulletMessage = Omit<typeof GotBulletMessage.Type, 'message'> & {
  readonly message: BulletMessage;
};

export const Message = Schema.Union([GotBulletMessage]);
export type Message = typeof Message.Type;
