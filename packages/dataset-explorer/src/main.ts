import { Html } from '@effect/ui/html';

import { Message } from './message';
import { initialModel, Model, Props } from './model';
import { update } from './update';
import { view } from './view';

export const DatasetExplorer = Html.component({
  name: 'DatasetExplorer',
  props: Props,
  model: Model,
  message: Message,
}).make({
  init: ({ props }) => initialModel(props),
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  view,
});
