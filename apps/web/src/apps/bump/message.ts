import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as BumpMessage } from '../../ui/bump-chart';

export const GotBumpMessage = m('GotBumpMessage', { message: Schema.Unknown });
export type GotBumpMessage = Omit<typeof GotBumpMessage.Type, 'message'> & {
  readonly message: BumpMessage;
};

export const Message = Schema.Union([GotBumpMessage]);
export type Message = typeof Message.Type;
