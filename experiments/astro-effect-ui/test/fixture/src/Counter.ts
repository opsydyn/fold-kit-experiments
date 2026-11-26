import { Head, Subscription, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Schema, Stream } from 'effect';

const Message = UiSchema.TaggedEnum({ ClickedIncrement: {} });

declare global {
  interface Window {
    activeIslands?: Map<string, number>;
  }
}

function adjustActiveCount(label: string, delta: number) {
  const counts = (window.activeIslands ??= new Map());
  counts.set(label, (counts.get(label) ?? 0) + delta);
}

function watchLifetime(label: string) {
  const acquire = Effect.sync(() => adjustActiveCount(label, 1));
  const release = Effect.sync(() => adjustActiveCount(label, -1));
  const resource = Effect.acquireRelease(acquire, () => release);
  const stream = resource.pipe(Effect.map(() => Stream.never));
  return Stream.unwrap(stream);
}

export const Counter = Html.component({
  name: 'Counter',
  props: Schema.Struct({ label: Schema.String, start: Schema.Number }),
  model: Schema.Struct({ count: Schema.Number }),
  message: Message,
}).make({
  init: ({ props }) => ({ count: props.start }),
  update: {
    ClickedIncrement: ($) => ({ count: $.model.count + 1 }),
  },
  head: () => [Head.title('Effect UI should not own the Astro title')],
  subscriptions: ({ props }) => [Subscription.make('active', watchLifetime(props.label))],
  view: (h, model) =>
    h.section(
      h.output.attr('aria-label', h.props.label).children(String(model.count)),
      h.button.on('click', Message.ClickedIncrement()).children(`Increment ${h.props.label}`),
    ),
});

export const StaticSummary = Html.component({
  name: 'StaticSummary',
  model: Schema.Null,
  message: Schema.Never,
}).make({
  init: () => null,
  update: ($) => $.model,
  view: (h) => h.p('Static summary'),
});
