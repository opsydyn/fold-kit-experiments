import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as PhyllotaxisMessage } from '../../ui/phyllotaxis-chart';

export const GotPhyllotaxisMessage = m('GotPhyllotaxisMessage', { message: Schema.Unknown });
export type GotPhyllotaxisMessage = Omit<typeof GotPhyllotaxisMessage.Type, 'message'> & {
  readonly message: PhyllotaxisMessage;
};

export const Message = Schema.Union([GotPhyllotaxisMessage]);
export type Message = typeof Message.Type;
