import { Command, Component } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect } from 'effect';

import { Message } from './message';
import { Model, Props } from './model';
import { presentationFor } from './presentation';
import { update } from './update';
import { view } from './view';

const ReflectDocument = Command.make('ReflectGreetingDocument', { args: Model }, (model) =>
  Effect.sync(() => {
    const { title, lang, dir, canonical, ogUrl } = presentationFor(model);
    const { document } = globalThis;
    document.title = title;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', ogUrl);
    return Component.noop;
  }),
);

export const Greeting = Html.component({
  name: 'Greeting',
  model: Model,
  message: Message,
  props: Props,
}).make({
  init: ({ props }) => props,
  update: ($, message) => {
    const model = update($.model, message);
    return $.set(model).run(ReflectDocument.make(model));
  },
  view,
});
