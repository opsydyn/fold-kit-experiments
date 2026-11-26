import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model } from './model';
import { subscriptions } from './subscription';
import { update } from './update';
import { view } from './view';

export default Html.component({ name: 'ThreeBars', model: Model, message: Message }).make({
  init: () => init().model,
  subscriptions,
  update: ({ model }, message) => update(model, message).model,
  view,
});
