import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as VoronoiMessage } from '../../ui/voronoi-chart';

export const Message = defineMessageUnion({
  GotVoronoiMessage: { message: Schema.Unknown },
});
export type GotVoronoiMessage = Omit<typeof Message.GotVoronoiMessage.Type, 'message'> & {
  readonly message: VoronoiMessage;
};
export type Message = typeof Message.Type;
