import { test } from 'bun:test';

import { Mount } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { HtmlScene } from '@effect/ui/html/testing';
import { Locator } from '@effect/ui/testing';
import { Effect, Schema } from 'effect';

import { scatterGeometry } from '../src/chart/cartesian';
import { lightTheme } from '../src/chart/theme';
import { chartFrame } from '../src/effect-ui/cartesian';

const { layout } = scatterGeometry(
  [0],
  { x: (d) => d, y: (d) => d, datumKey: () => 'a', seriesKey: () => 'a' },
  { frame: { width: 200, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } } },
);
const Measure = Mount.make('MeasureChartFrame', { args: {} }, () => Effect.succeed(220));

const Chart = Html.component({
  name: 'MeasuredChart',
  model: Schema.Number,
  message: Schema.Number,
}).make({
  init: () => 0,
  update: (_, message) => message,
  view: (h, width) =>
    h.div.children(
      chartFrame(
        h,
        {
          layout,
          title: 'Chart',
          description: 'Measured width',
          theme: lightTheme,
          interactive: true,
          onMount: Measure(),
        },
        [],
      ),
      h.output.children(`Width ${width}`),
    ),
});

test('an Effect UI mount on the chart frame reports to the owning component', async () => {
  const run = Effect.gen(function* () {
    const scene = yield* HtmlScene.make(Chart, {});
    scene
      .expect(Locator.attr('tabindex', '0'))
      .toExist()
      .mounted(Measure, 220)
      .expect(Locator.text('Width 220'))
      .toExist();
  });
  const scoped = Effect.scoped(run);
  await Effect.runPromise(scoped);
});
