import { Component } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Layer, Schema } from 'effect';

import { roomEnvironmentLayer } from './command';
import { Message } from './message';
import { Model } from './model';
import { roomPresenceLayer, subscriptions } from './presence';
import { init, update } from './update';
import { view } from './view';

const Room = Html.component({
  name: 'ThreeRoom',
  props: Schema.Struct({ assetBase: Schema.optionalKey(Schema.String) }),
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

export default Component.provide(Room, Layer.merge(roomEnvironmentLayer(), roomPresenceLayer()), {
  server: false,
  local: true,
});
