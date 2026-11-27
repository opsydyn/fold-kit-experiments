import { Command, Component } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import { Message } from './message';
import { _count, init, Model } from './model';
import { subscriptions } from './subscription';
import { update } from './update';
import { view } from './view';

const ReflectCount = Command.make(
  'ReflectCounterTitle',
  { args: { count: Schema.Number } },
  ({ count }) =>
    Effect.sync(() => {
      globalThis.document.title = `Counter: ${count}`;
    }).pipe(Effect.map(() => Component.noop)),
);

export const Counter = Html.component({
  name: 'Counter',
  model: Model,
  message: Message,
}).make({
  init: () => init,
  update: ($, message) => {
    const result = update($.model, message);
    const step = $.set(result.model).run(...(result.commands ?? []));
    if (result.model.count === $.model.count) return step;
    return step.run(ReflectCount.make({ count: _count.get(result.model) }));
  },
  subscriptions,
  view,
});
