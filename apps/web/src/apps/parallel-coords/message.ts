import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ParallelCoordsMessage } from '../../ui/parallel-coords-chart';

export const Message = defineMessageUnion({
  GotParallelCoordsMessage: { message: Schema.Unknown },
});
export type GotParallelCoordsMessage = Omit<typeof Message.GotParallelCoordsMessage.Type, 'message'> & {
  readonly message: ParallelCoordsMessage;
};
export type Message = typeof Message.Type;
