import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as GraphMessage } from '../../ui/force-graph';

export const GotGraphMessage = m('GotGraphMessage', { message: Schema.Unknown });
export type GotGraphMessage = Omit<typeof GotGraphMessage.Type, 'message'> & {
  readonly message: GraphMessage;
};

export const Message = Schema.Union([GotGraphMessage]);
export type Message = typeof Message.Type;
