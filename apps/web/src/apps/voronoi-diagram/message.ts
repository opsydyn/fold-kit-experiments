import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as VoronoiMessage } from '../../ui/voronoi-chart';

export const Message = defineMessageUnion({
  ReceivedVoronoiMessage: { message: Schema.Unknown },
});
export type ReceivedVoronoiMessage = Omit<typeof Message.ReceivedVoronoiMessage.Type, 'message'> & {
  readonly message: VoronoiMessage;
};
export type Message = typeof Message.Type;
