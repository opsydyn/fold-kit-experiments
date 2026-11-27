import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model } from './model';
import { update } from './update';
import { view } from './view';

export default Html.component({ name: 'ThreeStudio', model: Model, message: Message }).make({
  init: () => init().model,
  update: ({ model }, message) => update(model, message).model,
  view,
});
