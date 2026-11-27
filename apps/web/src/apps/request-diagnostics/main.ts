import { Html } from '@effect/ui/html';

import { Message } from './message';
import { initModel, Model } from './model';
import { update } from './update';
import { view } from './view';

export { update };

export const RequestDiagnostics = Html.component({
  name: 'RequestDiagnostics',
  model: Model,
  message: Message,
}).make({
  init: () => initModel,
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  view,
});
