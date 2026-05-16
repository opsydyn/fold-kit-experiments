import { Schema } from 'effect';
import * as Carousel from '../../ui/carousel';

export const SLIDE_COUNT = 5;

export const Model = Schema.Struct({
  carousel: Schema.Unknown,
});
export type Model = Omit<typeof Model.Type, 'carousel'> & {
  readonly carousel: Carousel.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => [
  { carousel: Carousel.init({ id: 'main', slideCount: SLIDE_COUNT, loop: true }) },
  [],
];
