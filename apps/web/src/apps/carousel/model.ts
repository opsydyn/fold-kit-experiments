import { Schema } from 'effect';
import type { AsyncData } from 'foldkit/asyncData';

import * as Carousel from '../../ui/carousel';

export const Slide = Schema.Struct({
  title: Schema.String,
  caption: Schema.String,
  bg: Schema.String,
});
export type Slide = typeof Slide.Type;

export const Model = Schema.Struct({
  carousel: Schema.Unknown,
  slides: Schema.Unknown,
});
export type Model = Omit<typeof Model.Type, 'carousel' | 'slides'> & {
  readonly carousel: Carousel.Model;
  readonly slides: AsyncData<ReadonlyArray<Slide>, string>;
};

// Carousel starts with 0 slides; slideCount is synced when LoadSlides settles.
export const initModel: Model = {
  carousel: Carousel.init({ id: 'main', slideCount: 0, loop: true }),
  slides: { _tag: 'Idle' },
};
