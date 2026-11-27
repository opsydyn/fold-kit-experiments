import { UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Schema } from 'effect';

const Message = UiSchema.TaggedEnum({ Incremented: {} });

export const Counter = Html.component({
  name: 'PackedAstroCounter',
  props: Schema.Struct({ start: Schema.Int }),
  model: Schema.Int,
  message: Message,
}).make({
  init: ({ props }) => props.start,
  update: ({ model }) => model + 1,
  view: (h, count) => h.button.on('click', Message.Incremented()).children(`Count: ${count}`),
});
