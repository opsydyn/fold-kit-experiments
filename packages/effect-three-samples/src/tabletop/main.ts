import { Component } from '@effect/ui';
import { Html } from '@effect/ui/html';

import { Message } from './message';
import { fresh, Model } from './model';
import { subscriptions, tabletopSessionLayer } from './session';
import { update } from './update';
import { view } from './view';

const Tabletop = Html.component({ name: 'ThreeTabletop', model: Model, message: Message }).make({
  init: () => fresh,
  update: ($, message) => {
    const next = update($.model, message);
    return $.set(next.model).run(...(next.commands ?? []));
  },
  subscriptions,
  view,
});

export default Component.provide(Tabletop, tabletopSessionLayer(), { server: false, local: true });
