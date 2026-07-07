import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as CarouselMessage } from '../../ui/carousel';

export const GotCarouselMessage = m('GotCarouselMessage', { message: Schema.Unknown });
export type GotCarouselMessage = Omit<typeof GotCarouselMessage.Type, 'message'> & {
  readonly message: CarouselMessage;
};

export const Message = Schema.Union([GotCarouselMessage]);
export type Message = typeof Message.Type;
