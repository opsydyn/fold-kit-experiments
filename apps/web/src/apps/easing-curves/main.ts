import { Html } from '@effect/ui/html';

import { init, Message, Model, update, view } from '../../ui/easing-curves-chart';

export const EasingCurves = Html.component({
  name: 'EasingCurves',
  model: Model,
  message: Message,
}).make({
  init: () => init,
  update: ($, message) => update($.model, message),
  view: (h, model) =>
    view(
      h,
      model,
      'Comparison of 6 easing functions: linear, sinOut, cubicOut, backOut, elasticOut, bounceOut',
    ),
});
