import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as ParallelCoordsMessage } from '../../ui/parallel-coords-chart';

export const GotParallelCoordsMessage = m('GotParallelCoordsMessage', { message: Schema.Unknown });
export type GotParallelCoordsMessage = Omit<typeof GotParallelCoordsMessage.Type, 'message'> & {
  readonly message: ParallelCoordsMessage;
};

export const Message = Schema.Union([GotParallelCoordsMessage]);
export type Message = typeof Message.Type;
