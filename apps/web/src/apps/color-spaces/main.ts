import { Html } from '@effect/ui/html';

import { init, Message, Model, update, view } from '../../ui/color-spaces-chart';

export const ColorSpaces = Html.component({
  name: 'ColorSpaces',
  model: Model,
  message: Message,
}).make({
  init: () => init,
  update: ($, message) => update($.model, message),
  view: (h, model) =>
    view(h, model, 'Red to blue gradient shown in RGB, HSL, and Lab color spaces'),
});
