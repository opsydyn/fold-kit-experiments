import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ArcMessage } from '../../ui/arc-diagram';

export const GotArcMessage = m('GotArcMessage', { inner: Schema.Unknown });
export type GotArcMessage = Omit<typeof GotArcMessage.Type, 'inner'> & {
  readonly inner: ArcMessage;
};

export const Message = Schema.Union([GotArcMessage]);
export type Message = typeof Message.Type;
