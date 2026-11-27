import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model, Props } from './model';
import { update } from './update';
import { view } from './view';

export const PromoSignals = Html.component({
  name: 'PromoSignals',
  model: Model,
  message: Message,
  props: Props,
}).make({
  init: ({ props }) => init(props).model,
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  view,
});
