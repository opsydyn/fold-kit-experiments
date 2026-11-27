import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model, Props } from './model';
import { subscriptions } from './subscription';
import { update } from './update';
import { view } from './view';

export const Timestamp = Html.component({
  name: 'Timestamp',
  model: Model,
  message: Message,
  props: Props,
}).make({
  init: ({ props }) => init(props),
  update: ($, message) => update($.model, message),
  subscriptions,
  view,
});
