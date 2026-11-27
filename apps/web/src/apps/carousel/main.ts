import { Html } from '@effect/ui/html';

import { LoadSlides } from './command';
import { Message } from './message';
import { Model } from './model';
import { subscriptions } from './subscription';
import { update } from './update';
import { view } from './view';

export const Carousel = Html.component({ name: 'Carousel', model: Model, message: Message }).make({
  init: ($) => $.set(Model.Loading()).run(LoadSlides.make({})),
  update: ($, message) => update($.model, message),
  subscriptions,
  view,
});
