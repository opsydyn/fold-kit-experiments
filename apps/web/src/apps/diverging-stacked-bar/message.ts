import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as DSBMessage } from '../../ui/diverging-stacked-bar';

export const GotDSBMessage = m('GotDSBMessage', { message: Schema.Unknown });
export type GotDSBMessage = Omit<typeof GotDSBMessage.Type, 'message'> & {
  readonly message: DSBMessage;
};
export const Message = Schema.Union([GotDSBMessage]);
export type Message = typeof Message.Type;
