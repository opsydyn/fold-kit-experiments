import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as BulletMessage } from '../../ui/bullet-chart';

export const GotBulletMessage = m('GotBulletMessage', { inner: Schema.Unknown });
export type GotBulletMessage = Omit<typeof GotBulletMessage.Type, 'inner'> & {
  readonly inner: BulletMessage;
};

export const Message = Schema.Union([GotBulletMessage]);
export type Message = typeof Message.Type;
