import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as TreeMessage } from '../../ui/tidy-tree-chart';

export const GotTreeMessage = m('GotTreeMessage', { message: Schema.Unknown });
export type GotTreeMessage = Omit<typeof GotTreeMessage.Type, 'message'> & {
  readonly message: TreeMessage;
};

export const Message = Schema.Union([GotTreeMessage]);
export type Message = typeof Message.Type;
