import { Html } from '@effect/ui/html';
import { Schema } from 'effect';

import { Message } from './message';
import { Model } from './model';
import { init, update } from './update';
import { view } from './view';

export default Html.component({
  name: 'ThreeBowling',
  props: Schema.Struct({ assetBase: Schema.optionalKey(Schema.String) }),
  model: Model,
  message: Message,
}).make({
  init: ({ props }) => init(props).model,
  update: ($, message) => {
    const next = update($.model, message);
    return $.set(next.model).run(...(next.commands ?? []));
  },
  view,
});
