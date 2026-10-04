import { Result, Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as CarouselMessage } from '../../ui/carousel';
import type { Slide } from './model';

export const Message = defineMessageUnion({
  ReceivedCarouselMessage: { message: Schema.Unknown },
  SettledSlides: { result: Schema.Unknown },
});
export type ReceivedCarouselMessage = Omit<
  typeof Message.ReceivedCarouselMessage.Type,
  'message'
> & {
  readonly message: CarouselMessage;
};
export type SettledSlides = Omit<typeof Message.SettledSlides.Type, 'result'> & {
  readonly result: Result.Result<ReadonlyArray<Slide>, string>;
};
export type Message = typeof Message.Type;
