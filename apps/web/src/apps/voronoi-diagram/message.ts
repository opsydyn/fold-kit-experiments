import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as VoronoiMessage } from '../../ui/voronoi-chart';

export const GotVoronoiMessage = m('GotVoronoiMessage', { inner: Schema.Unknown });
export type GotVoronoiMessage = Omit<typeof GotVoronoiMessage.Type, 'inner'> & {
  readonly inner: VoronoiMessage;
};

export const Message = Schema.Union([GotVoronoiMessage]);
export type Message = typeof Message.Type;
