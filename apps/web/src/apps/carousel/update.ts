import { Match, Option, Result } from 'effect';
import { revalidateOrLoad, settle } from 'foldkit/asyncData';
import { combine, refresh } from 'foldkit/update';
import type { Return, Step } from 'foldkit/update';

import * as Carousel from '../../ui/carousel';
import { LoadSlides } from './command';
import type { Message } from './message';
import type { Model, Slide } from './model';

type AppReturn = Return<Model, Message>;

// Revalidates the slides cache: Idle/Failure → Loading, Success/Stale → Refreshing.
// Data-last so it can be used as a Step in combine() or called directly from init.
export const loadSlidesOnEntry: Step<Model, Message> = refresh<
  Model,
  Message,
  ReadonlyArray<Slide>,
  string
>({
  read: (model) => Option.some(model.slides),
  revalidate: revalidateOrLoad,
  write: (model, slides) => ({ ...model, slides }),
  load: LoadSlides(),
});

// Syncs carousel.slideCount to match the loaded slide array length.
const syncSlideCount =
  (slides: ReadonlyArray<Slide>): Step<Model, Message> =>
  (model) => [{ ...model, carousel: { ...model.carousel, slideCount: slides.length } }, []];

export const update = (model: Model, message: Message): AppReturn =>
  Match.value(message).pipe(
    Match.withReturnType<AppReturn>(),
    Match.tagsExhaustive({
      GotCarouselMessage: ({ message: carouselMessage }) => {
        const [nextCarousel] = Carousel.update(model.carousel, carouselMessage as Carousel.Message);
        return [{ ...model, carousel: nextCarousel }, []];
      },

      SettledSlides: ({ result: rawResult }) => {
        const result = rawResult as Result.Result<ReadonlyArray<Slide>, string>;
        return combine(model, [
          (m) => [{ ...m, slides: settle(m.slides, result) }, []],
          ...Result.match(result, {
            onSuccess: (slides) => [syncSlideCount(slides)],
            onFailure: () => [],
          }),
        ]);
      },
    }),
  );
