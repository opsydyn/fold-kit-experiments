import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as GraphMessage } from '../../ui/force-graph';

export const GotGraphMessage = m('GotGraphMessage', { inner: Schema.Unknown });
export type GotGraphMessage = Omit<typeof GotGraphMessage.Type, 'inner'> & {
  readonly inner: GraphMessage;
};

export const Message = Schema.Union([GotGraphMessage]);
export type Message = typeof Message.Type;
