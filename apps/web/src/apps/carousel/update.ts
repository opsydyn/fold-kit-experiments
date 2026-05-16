import { Match } from 'effect';
import * as Carousel from '../../ui/carousel';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotCarouselMessage: ({ inner }) => {
        const [nextCarousel] = Carousel.update(model.carousel, inner as Carousel.Message);
        return [{ ...model, carousel: nextCarousel }, []];
      },
    }),
  );
