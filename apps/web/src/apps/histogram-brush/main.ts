import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model } from './model';
import { update } from './update';
import { view } from './view';

export const HistogramBrush = Html.component({
  name: 'HistogramBrush',
  model: Model,
  message: Message,
}).make({
  init: () => init,
  update: ($, message) => update($.model, message),
  view,
});
