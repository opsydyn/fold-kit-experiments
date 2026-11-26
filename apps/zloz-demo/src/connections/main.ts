import { Html } from '@effect/ui/html';

import { init, Message, Model, update, type Model as WorkbenchModel } from './state';
import { view } from './view';

function workbenchModel(model: typeof Model.Type): WorkbenchModel {
  // SAFETY: both sessions are initialized by this island and transferred as JSON snapshots.
  return model as WorkbenchModel;
}

export default Html.component({
  name: 'ZlozConnections',
  model: Model,
  message: Message,
}).make({
  init,
  update: ($, message) => update(workbenchModel($.model), message),
  view: (h, model) => view(h, workbenchModel(model)),
});
