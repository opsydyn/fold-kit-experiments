import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ArcMessage } from '../../ui/arc-diagram';

export const GotArcMessage = m('GotArcMessage', { message: Schema.Unknown });
export type GotArcMessage = Omit<typeof GotArcMessage.Type, 'message'> & {
  readonly message: ArcMessage;
};

export const Message = Schema.Union([GotArcMessage]);
export type Message = typeof Message.Type;
