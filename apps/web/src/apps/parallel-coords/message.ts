import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ParallelCoordsMessage } from '../../ui/parallel-coords-chart';

export const Message = defineMessageUnion({
  ReceivedParallelCoordsMessage: { message: Schema.Unknown },
});
export type ReceivedParallelCoordsMessage = Omit<
  typeof Message.ReceivedParallelCoordsMessage.Type,
  'message'
> & {
  readonly message: ParallelCoordsMessage;
};
export type Message = typeof Message.Type;
