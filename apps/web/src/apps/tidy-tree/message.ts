import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as TreeMessage } from '../../ui/tidy-tree-chart';

export const GotTreeMessage = m('GotTreeMessage', { inner: Schema.Unknown });
export type GotTreeMessage = Omit<typeof GotTreeMessage.Type, 'inner'> & {
  readonly inner: TreeMessage;
};

export const Message = Schema.Union([GotTreeMessage]);
export type Message = typeof Message.Type;
