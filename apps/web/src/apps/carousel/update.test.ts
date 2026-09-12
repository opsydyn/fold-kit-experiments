import { describe, expect, it } from 'vitest';

import * as Carousel from '../../ui/carousel';
import { Message } from './message';
import { initModel } from './model';
import { update } from './update';

const modelWithSlides = {
  ...initModel,
  carousel: Carousel.init({ id: 'main', slideCount: 3, loop: false }).model,
};

describe('carousel update composition', () => {
  it('emits a ChangedSlide out message from the child update', () => {
    const result = Carousel.update(modelWithSlides.carousel, Carousel.Message.ClickedNext());

    expect(result.model.activeIndex).toBe(1);
    expect(result.outMessage).toEqual(Carousel.OutMessage.ChangedSlide({ index: 1 }));
  });

  it('handles the child out message at the application boundary', () => {
    const result = update(
      modelWithSlides,
      Message.GotCarouselMessage({ message: Carousel.Message.ClickedNext() }),
    );

    expect(result.model.carousel.activeIndex).toBe(1);
    expect(result.outMessage).toBeUndefined();
  });
});
