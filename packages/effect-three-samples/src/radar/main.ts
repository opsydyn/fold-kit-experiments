import { Html } from '@effect/ui/html';
import { Schema } from 'effect';

import { Message } from './message';
import { Link, Model } from './model';
import { subscriptions } from './subscription';
import { init, update } from './update';
import { view } from './view';

export type { RadarProps } from './model';

const RadarProps = Schema.Struct({
  assetBase: Schema.optionalKey(Schema.String),
  links: Schema.optionalKey(Schema.Array(Link)),
  link: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
});

export default Html.component({
  name: 'ThreeRadar',
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
