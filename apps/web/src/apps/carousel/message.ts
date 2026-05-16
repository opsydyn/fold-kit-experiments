import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as CarouselMessage } from '../../ui/carousel';

export const GotCarouselMessage = m('GotCarouselMessage', { inner: Schema.Unknown });
export type GotCarouselMessage = Omit<typeof GotCarouselMessage.Type, 'inner'> & {
  readonly inner: CarouselMessage;
};

export const Message = Schema.Union([GotCarouselMessage]);
export type Message = typeof Message.Type;
