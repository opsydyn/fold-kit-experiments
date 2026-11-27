import { Html } from '@effect/ui/html';

import { init, Message, Model, update, view } from '../../ui/phyllotaxis-chart';

export const Phyllotaxis = Html.component({
  name: 'Phyllotaxis',
  model: Model,
  message: Message,
}).make({
  init: () => init,
  update: ($, message) => update($.model, message),
  view: (h, model) => view(h, model, 'Phyllotaxis zoom and pan'),
});
