import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as StreamgraphMessage } from '../../ui/streamgraph-chart';

export const GotStreamgraphMessage = m('GotStreamgraphMessage', { inner: Schema.Unknown });
export type GotStreamgraphMessage = Omit<typeof GotStreamgraphMessage.Type, 'inner'> & {
  readonly inner: StreamgraphMessage;
};

export const Message = Schema.Union([GotStreamgraphMessage]);
export type Message = typeof Message.Type;
