import { Result, Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as CarouselMessage } from '../../ui/carousel';
import type { Slide } from './model';

export const GotCarouselMessage = m('GotCarouselMessage', { message: Schema.Unknown });
export type GotCarouselMessage = Omit<typeof GotCarouselMessage.Type, 'message'> & {
  readonly message: CarouselMessage;
};

export const SettledSlides = m('SettledSlides', { result: Schema.Unknown });
export type SettledSlides = Omit<typeof SettledSlides.Type, 'result'> & {
  readonly result: Result.Result<ReadonlyArray<Slide>, string>;
};

export const Message = Schema.Union([GotCarouselMessage, SettledSlides]);
export type Message = typeof Message.Type;
