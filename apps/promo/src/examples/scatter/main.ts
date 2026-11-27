import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model, Props } from './model';
import { update } from './update';
import { view } from './view';

export { init, Model, Message, update, view };

export const Scatter = Html.component({
  name: 'PromoScatter',
  props: Props,
  model: Model,
  message: Message,
}).make({
  init: ({ props }) => init(props).model,
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  view,
});
