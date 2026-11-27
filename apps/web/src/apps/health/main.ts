import { Html } from '@effect/ui/html';

import { FetchHealth } from './command';
import { Message } from './message';
import { init, Model } from './model';
import { subscriptions } from './subscription';
import { update } from './update';
import { view } from './view';

export const Health = Html.component({
  name: 'Health',
  model: Model,
  message: Message,
}).make({
  init: ($) => $.set(init).run(FetchHealth.make({})),
  update: ($, message) => update($.model, message),
  subscriptions,
  view,
});
