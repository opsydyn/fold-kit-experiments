import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model } from './model';
import { update } from './update';
import { view } from './view';

export const LinkedCharts = Html.component({
  name: 'LinkedCharts',
  model: Model,
  message: Message,
}).make({
  init: () => init().model,
  update: ($, message) => update($.model, message).model,
  view,
});
