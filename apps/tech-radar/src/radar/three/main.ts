import { Html } from '@effect/ui/html';

import { Message } from './message';
import { Model, RadarProps } from './model';
import { subscriptions } from './subscription';
import { init, update } from './update';
import { view } from './view';

export default Html.component({
  name: 'TechRadar',
  props: RadarProps,
  model: Model,
  message: Message,
}).make({
  init: ({ props }) => init(props).model,
  update: ($, message) => {
    const next = update($.model, message);
    return $.set(next.model).run(...(next.commands ?? []));
  },
  subscriptions,
  view,
});
