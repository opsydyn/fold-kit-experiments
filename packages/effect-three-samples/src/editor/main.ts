import { Component } from '@effect/ui';
import { Html } from '@effect/ui/html';

import { Message } from './message';
import { init, Model } from './model';
import { editorSessionLayer, subscriptions } from './session';
import { update } from './update';
import { view } from './view';

const Editor = Html.component({ name: 'ThreeEditor', model: Model, message: Message }).make({
  init: () => init().model,
  update: ($, message) => {
    const next = update($.model, message);
    return $.set(next.model).run(...(next.commands ?? []));
  },
  subscriptions,
  view,
});

export default Component.provide(Editor, editorSessionLayer(), { server: false, local: true });
