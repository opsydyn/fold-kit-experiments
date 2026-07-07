import { Match, Option, Result } from 'effect';
import { AsyncData } from 'foldkit/asyncData';
import { Update } from 'foldkit/update';

import * as Carousel from '../../ui/carousel';
import { LoadSlides } from './command';
import type { Message } from './message';
import type { Model, Slide } from './model';

type Return = Update.Return<Model, Message>;

// Revalidates the slides cache: Idle/Failure → Loading, Success/Stale → Refreshing.
// Data-last so it can be used as a Step in combine() or called directly from init.
export const loadSlidesOnEntry: Update.Step<Model, Message> = Update.refresh({
  read: (model) => Option.some(model.slides),
  revalidate: AsyncData.revalidateOrLoad,
  write: (model, slides) => ({ ...model, slides }),
  load: LoadSlides(),
});

// Syncs carousel.slideCount to match the loaded slide array length.
const syncSlideCount = (slides: ReadonlyArray<Slide>): Update.Step<Model, Message> =>
  (model) => [{ ...model, carousel: { ...model.carousel, slideCount: slides.length } }, []];

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotCarouselMessage: ({ message: carouselMessage }) => {
        const [nextCarousel] = Carousel.update(model.carousel, carouselMessage as Carousel.Message);
        return [{ ...model, carousel: nextCarousel }, []];
      },

      SettledSlides: ({ result }) =>
        Update.combine(model, [
          (m) => [{ ...m, slides: AsyncData.settle(m.slides, result) }, []],
          ...Result.match(result, {
            onSuccess: (slides) => [syncSlideCount(slides)],
            onFailure: () => [],
          }),
        ]),
    }),
  );
