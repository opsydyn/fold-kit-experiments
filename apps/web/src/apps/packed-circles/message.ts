import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as PackedMessage } from '../../ui/packed-circles-chart';

export const GotPackedMessage = m('GotPackedMessage', { message: Schema.Unknown });
export type GotPackedMessage = Omit<typeof GotPackedMessage.Type, 'message'> & {
  readonly message: PackedMessage;
};

export const Message = Schema.Union([GotPackedMessage]);
export type Message = typeof Message.Type;
