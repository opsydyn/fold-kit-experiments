import { Html } from '@effect/ui/html';

import { workbenchCommands } from './workbench-focus';
import { init, Message, Model, update } from './workbench-state';
import { workbenchView } from './workbench-view';

export const Comparison = Html.component({
  name: 'ComparisonWorkbench',
  model: Model,
  message: Message,
}).make({
  init: () => init(),
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...workbenchCommands(result));
  },
  view: (h, model) => workbenchView(h, model, (message) => message),
});
