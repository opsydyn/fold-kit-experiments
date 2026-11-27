import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model, Props } from './model';
import { update } from './update';
import { view } from './view';

export const Bars = Html.component({
  name: 'PromoBars',
  props: Props,
  model: Model,
  message: Message,
}).make({
  init: ({ props }) => init(props),
  update: ($, message) => update($.model, message),
  view,
});
