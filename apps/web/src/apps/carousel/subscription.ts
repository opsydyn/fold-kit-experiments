import { Subscription } from 'foldkit';
import * as Carousel from '../../ui/carousel';
import type { Message } from './message';
import { GotCarouselMessage } from './message';
import type { Model } from './model';

export const subscriptions = Subscription.lift(Carousel.subscriptions)<Model, Message>({
  toChildModel: (model) => model.carousel,
  toParentMessage: (inner) => GotCarouselMessage({ inner }),
});
