import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model } from './model';
import { update } from './update';
import { view } from './view';

export const Zloz = Html.component({
  name: 'WorkflowEditor',
  model: Model,
  message: Message,
}).make({
  init,
  update: ($, message) => {
    // SAFETY: only this component constructs the editor and layout request snapshots.
    const result = update($.model as Model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  // SAFETY: hydration restores the snapshot emitted by this component.
  view: (h, model) => view(h, model as Model),
});
