import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as SankeyMessage } from '../../ui/sankey-chart';

export const GotSankeyMessage = m('GotSankeyMessage', { message: Schema.Unknown });
export type GotSankeyMessage = Omit<typeof GotSankeyMessage.Type, 'message'> & {
  readonly message: SankeyMessage;
};

export const Message = Schema.Union([GotSankeyMessage]);
export type Message = typeof Message.Type;
