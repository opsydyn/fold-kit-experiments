import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as VoronoiMessage } from '../../ui/voronoi-chart';

export const GotVoronoiMessage = m('GotVoronoiMessage', { message: Schema.Unknown });
export type GotVoronoiMessage = Omit<typeof GotVoronoiMessage.Type, 'message'> & {
  readonly message: VoronoiMessage;
};

export const Message = Schema.Union([GotVoronoiMessage]);
export type Message = typeof Message.Type;
