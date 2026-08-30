import { Subscription } from 'foldkit';

import * as Carousel from '../../ui/carousel';
import { Message } from './message';
import type { Model } from './model';

export const subscriptions = Subscription.lift(Carousel.subscriptions)<Model, Message>({
  toChildModel: (model) => model.carousel,
  toParentMessage: (message) => Message.GotCarouselMessage({ message }),
});
