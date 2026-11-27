import { Component } from '@effect/ui';
import { Html } from '@effect/ui/html';

import { toyboxLayer } from './command';
import { Message } from './message';
import { Model } from './model';
import { init, update } from './update';
import { view } from './view';

const Toybox = Html.component({ name: 'ThreeToybox', model: Model, message: Message }).make({
  init: () => init().model,
  update: ($, message) => {
    const next = update($.model, message);
    return $.set(next.model).run(...(next.commands ?? []));
  },
  view,
});

export default Component.provide(Toybox, toyboxLayer(), { server: false, local: true });
