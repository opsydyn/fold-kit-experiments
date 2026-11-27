import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model } from './model';
import { subscriptions } from './subscription';
import { update } from './update';
import { view } from './view';

export const AnimatedBar = Html.component({
  name: 'AnimatedBar',
  model: Model,
  message: Message,
}).make({
  init: () => init,
  update: ($, message) => update($.model, message),
  subscriptions,
  view,
});
