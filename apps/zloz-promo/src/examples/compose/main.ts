import { Html } from '@effect/ui/html';

import { init, Message, Model, update, type Model as ComposeModel } from './state';
import { view } from './view';

function editorModel(model: typeof Model.Type): ComposeModel {
  // SAFETY: this component initializes the editor itself; Astro transfers its JSON snapshot.
  return model as ComposeModel;
}

export default Html.component({
  name: 'ZlozCompose',
  model: Model,
  message: Message,
}).make({
  init,
  update: ($, message) => update(editorModel($.model), message),
  view: (h, model) => view(h, editorModel(model)),
});
