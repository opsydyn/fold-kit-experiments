import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model } from './model';
import { subscriptions } from './subscription';
import { update } from './update';
import { view } from './view';

export default Html.component({ name: 'ThreeChart', model: Model, message: Message }).make({
  init,
  update: ({ model }, message) => update(model, message),
  subscriptions,
  view,
});
