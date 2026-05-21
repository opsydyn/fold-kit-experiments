import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as SankeyMessage } from '../../ui/sankey-chart';

export const GotSankeyMessage = m('GotSankeyMessage', { inner: Schema.Unknown });
export type GotSankeyMessage = Omit<typeof GotSankeyMessage.Type, 'inner'> & {
  readonly inner: SankeyMessage;
};

export const Message = Schema.Union([GotSankeyMessage]);
export type Message = typeof Message.Type;
