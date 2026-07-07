import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as StreamgraphMessage } from '../../ui/streamgraph-chart';

export const GotStreamgraphMessage = m('GotStreamgraphMessage', { message: Schema.Unknown });
export type GotStreamgraphMessage = Omit<typeof GotStreamgraphMessage.Type, 'message'> & {
  readonly message: StreamgraphMessage;
};

export const Message = Schema.Union([GotStreamgraphMessage]);
export type Message = typeof Message.Type;
