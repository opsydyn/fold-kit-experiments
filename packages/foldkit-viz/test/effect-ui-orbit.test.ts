import { expect, it } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import { orbitGeometry } from '../src/chart/orbit.js';
import { orbitChart } from '../src/effect-ui/orbit.js';
import { hatchPattern, radialGradient } from '../src/effect-ui/paint.js';

const geometry = orbitGeometry(
  [{ id: 'alpha', risk: 5 }],
  { key: (datum) => datum.id, value: (datum) => datum.risk, halo: () => 'contract' },
  { size: 200 },
);
const Message = Schema.Struct({ key: Schema.String });
type Message = typeof Message.Type;

function fixture(interactive: boolean) {
  return Html.component({
    name: 'OrbitFixture',
    model: Schema.Struct({}),
    message: Message,
  }).make({
    init: () => ({}),
    update: ({ model }) => model,
    view: (h: Html.H<Message>) =>
      orbitChart(h, {
        geometry,
        title: 'Orbit',
        description: 'One module',
        defs: [
          radialGradient(h, { id: 'core', stops: [{ offset: 0, colour: 'red' }] }),
          hatchPattern(h, { id: 'hatch', spacing: 4, colour: 'currentColor' }),
        ],
        coreFill: 'url(#core)',
        haloColour: () => 'blue',
        nodeStyle: () => ({ fill: 'green', stroke: 'red' }),
        labelFor: (datum) => datum.id,
        selectedKey: 'alpha',
        onSelect: interactive ? (key) => ({ key }) : undefined,
      }),
  });
}

it('renders valid paint and exposes orbit marks as buttons only in interactive mode', async () => {
  const interactive = await Effect.runPromise(HtmlServer.renderToHtml(fixture(true), {}));
  expect(interactive.html).toContain('role="group"');
  expect(interactive.html).toContain('aria-pressed="true"');
  expect(interactive.html).toContain('tabindex="0"');
  expect(interactive.html).toContain('<radialGradient id="core"');
  expect(interactive.html).toContain('patternUnits="userSpaceOnUse"');
  expect(interactive.html).toContain('fill="url(#core)"');
  const staticChart = await Effect.runPromise(HtmlServer.renderToHtml(fixture(false), {}));
  expect(staticChart.html).toContain('role="img"');
  expect(staticChart.html).not.toContain('tabindex');
  expect(staticChart.html).toContain('<title>alpha</title>');
});
