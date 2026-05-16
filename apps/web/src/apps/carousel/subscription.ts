import { Stream } from 'effect';
import { Subscription } from 'foldkit';
import type { Message as CarouselMessage } from '../../ui/carousel';
import * as Carousel from '../../ui/carousel';
import type { Message } from './message';
import { GotCarouselMessage } from './message';
import type { Model } from './model';

const lift = (stream: Stream.Stream<CarouselMessage>): Stream.Stream<Message> =>
  stream.pipe(Stream.map((inner) => GotCarouselMessage({ inner })));

export const subscriptions = Subscription.makeSubscriptions(Carousel.SubscriptionDependencies)<
  Model,
  Message
>({
  dragPointer: {
    modelToDependencies: (model) =>
      Carousel.subscriptions.dragPointer.modelToDependencies(model.carousel),
    dependenciesToStream: (deps, readDeps) =>
      lift(Carousel.subscriptions.dragPointer.dependenciesToStream(deps, readDeps)),
  },
  dragEscape: {
    modelToDependencies: (model) =>
      Carousel.subscriptions.dragEscape.modelToDependencies(model.carousel),
    dependenciesToStream: (deps, readDeps) =>
      lift(Carousel.subscriptions.dragEscape.dependenciesToStream(deps, readDeps)),
  },
  settle: {
    modelToDependencies: (model) =>
      Carousel.subscriptions.settle.modelToDependencies(model.carousel),
    dependenciesToStream: (isSettling, readIsSettling) =>
      lift(Carousel.subscriptions.settle.dependenciesToStream(isSettling, readIsSettling)),
  },
});
