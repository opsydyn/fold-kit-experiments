import { Html } from '@effect/ui/html';

import { Message } from './message';
import { initialModel, Model } from './model';
import { update } from './update';
import { view } from './view';

export const ZoomableChoropleth = Html.component({
  name: 'ZoomableChoropleth',
  model: Model,
  message: Message,
}).make({
  init: () => initialModel,
  update: ($, message) => update($.model, message),
  view,
});
