import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ParallelCoordsMessage } from '../../ui/parallel-coords-chart';

export const GotParallelCoordsMessage = m('GotParallelCoordsMessage', { inner: Schema.Unknown });
export type GotParallelCoordsMessage = Omit<typeof GotParallelCoordsMessage.Type, 'inner'> & {
  readonly inner: ParallelCoordsMessage;
};

export const Message = Schema.Union([GotParallelCoordsMessage]);
export type Message = typeof Message.Type;
