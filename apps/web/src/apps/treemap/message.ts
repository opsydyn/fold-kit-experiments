import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as TreemapMessage } from '../../ui/treemap-chart';

export const GotTreemapMessage = m('GotTreemapMessage', { inner: Schema.Unknown });
export type GotTreemapMessage = Omit<typeof GotTreemapMessage.Type, 'inner'> & {
  readonly inner: TreemapMessage;
};

export const Message = Schema.Union([GotTreemapMessage]);
export type Message = typeof Message.Type;
