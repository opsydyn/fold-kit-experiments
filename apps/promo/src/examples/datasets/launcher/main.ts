import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model, Props } from './model';
import { update } from './update';
import { view } from './view';

export const DatasetLauncher = Html.component({
  name: 'DatasetLauncher',
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
