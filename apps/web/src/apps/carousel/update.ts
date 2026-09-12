import { Option, Result } from 'effect';
import { revalidateOrLoad, settle } from 'foldkit/asyncData';
import { combine, foldChild, refresh } from 'foldkit/update';
import type { Return, Step } from 'foldkit/update';

import * as Carousel from '../../ui/carousel';
import { LoadSlides } from './command';
import { Message } from './message';
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
  (model) => ({ model: { ...model, carousel: { ...model.carousel, slideCount: slides.length } } });

// The application is the terminal parent for the carousel, so it consumes the
// child notification explicitly instead of dropping the outMessage field.
const foldCarousel = foldChild({
  update: Carousel.update,
  read: (model: Model) => Option.some(model.carousel),
  write: (model, nextCarousel) => ({ ...model, carousel: nextCarousel }),
  toParentMessage: (carouselMessage) => Message.GotCarouselMessage({ message: carouselMessage }),
  foldOutMessage: (outMessage) =>
    Carousel.OutMessage.match<Step<Model, Message>>(outMessage, {
      ChangedSlide: () => (model) => ({ model }),
    }),
});

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    GotCarouselMessage: ({ message: carouselMessage }) => {
      return foldCarousel(model, carouselMessage as Carousel.Message);
    },

    SettledSlides: ({ result: rawResult }) => {
      const result = rawResult as Result.Result<ReadonlyArray<Slide>, string>;
      return combine(model, [
        (m) => ({ model: { ...m, slides: settle(m.slides, result) } }),
        ...Result.match(result, {
          onSuccess: (slides) => [syncSlideCount(slides)],
          onFailure: () => [],
        }),
      ]);
    },
  });
