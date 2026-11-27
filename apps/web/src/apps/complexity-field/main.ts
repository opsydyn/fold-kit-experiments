import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model } from './model';
import { update } from './update';
import { view } from './view';

export const ComplexityField = Html.component({
  name: 'ComplexityField',
  model: Model,
  message: Message,
}).make({
  init: () => init,
  update: ($, message) => update($.model, message),
  view,
});
