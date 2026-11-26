import { UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Schema } from 'effect';

const Message = UiSchema.TaggedEnum({ ClickedWelcome: {} });

export const Greeting = Html.component({
  name: 'Greeting',
  props: Schema.Struct({ name: Schema.String }),
  model: Schema.Struct({ name: Schema.String, prefix: Schema.String }),
  message: Message,
}).make({
  init: ({ props }) => ({ name: props.name, prefix: 'Hello' }),
  update: { ClickedWelcome: ($) => $.evolve({ prefix: () => 'Welcome' }) },
  view: (h, model) =>
    h.div(
      h.output(`${model.prefix}, ${model.name}!`),
      h.button.on('click', Message.ClickedWelcome()).children('Welcome'),
    ),
});
