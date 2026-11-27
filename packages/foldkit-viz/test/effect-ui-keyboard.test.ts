import { test } from 'bun:test';

import { UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { HtmlScene } from '@effect/ui/html/testing';
import { Locator } from '@effect/ui/testing';
import { Effect, Schema } from 'effect';

import { scatterGeometry } from '../src/chart/cartesian';
import { lightTheme } from '../src/chart/theme';
import { chartFrame } from '../src/effect-ui/cartesian';

const frame = { width: 160, height: 90, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
const { layout } = scatterGeometry(
  [{ x: 1, y: 2, key: 'dot' }],
  {
    x: (point) => point.x,
    y: (point) => point.y,
    datumKey: (point) => point.key,
    seriesKey: () => 'one',
  },
  { frame },
);

const Message = UiSchema.TaggedEnum({ Stepped: {} });

const Chart = Html.component({
  name: 'KeyboardChart',
  model: Schema.Number,
  message: Message,
}).make({
  init: () => 0,
  update: { Stepped: ({ model }) => model + 1 },
  view: (h, model) =>
    h.div.children(
      chartFrame(
        h,
        {
          layout,
          title: 'Keyboard chart',
          description: 'One point',
          theme: lightTheme,
          onKeyDown: (key) => (key === 'ArrowRight' ? Message.Stepped() : undefined),
        },
        [],
      ),
      h.output.children(`Selected ${model}`),
    ),
});

test('the Effect UI frame consumes handled chart keys and leaves browser shortcuts alone', async () => {
  const chart = Locator.tag('svg');
  const run = Effect.gen(function* () {
    const scene = yield* HtmlScene.make(Chart, {});
    scene
      .keydown(chart, 'ArrowRight')
      .expectDefaultPrevented()
      .expect(Locator.text('Selected 1'))
      .toExist()
      .keydown(chart, 'ArrowRight', { ctrl: true })
      .expectDefaultPrevented(false)
      .expectIgnored()
      .keydown(chart, 'ArrowRight', { meta: true })
      .expectDefaultPrevented(false)
      .expectIgnored()
      .keydown(chart, 'ArrowRight', { alt: true })
      .expectDefaultPrevented(false)
      .expectIgnored()
      .keydown(chart, 'ArrowRight', { composing: true })
      .expectDefaultPrevented(false)
      .expectIgnored()
      .keydown(chart, 'ArrowRight', { editable: true })
      .expectDefaultPrevented(false)
      .expectIgnored()
      .keydown(chart, 'Tab')
      .expectDefaultPrevented(false)
      .expectIgnored()
      .expect(Locator.text('Selected 1'))
      .toExist();
  });
  const scoped = Effect.scoped(run);
  await Effect.runPromise(scoped);
});
