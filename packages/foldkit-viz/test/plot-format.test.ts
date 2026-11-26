import { expect, it } from 'bun:test';

import { Result } from 'effect';

import { compileChecked, decodePlot } from '../src/effect/plot';
import { describePlot, plotTables, type PlotSpec } from '../src/plot';
import { plotHtml, plotSvg } from '../src/svg/plot';

const first = Date.UTC(2026, 0, 15, 12);
const last = Date.UTC(2026, 0, 15, 14);
const spec = {
  width: 620,
  height: 260,
  data: [
    { at: '2026-01-15T12:00:00', duration: 120 },
    { at: '2026-01-15T15:00:00+01:00', duration: 240 },
  ],
  x: { label: 'Hour', format: { kind: 'dateTime', locale: 'en-GB', timeStyle: 'short' } },
  y: {
    domain: [0, 300],
    label: 'Latency',
    format: { kind: 'unit', unit: 'millisecond', locale: 'en-GB', digits: 0 },
  },
  marks: [{ mark: 'dot', x: 'at', y: 'duration' }],
} satisfies PlotSpec;

it('round trips formats through the checked wire API and agrees across SVG, summary and table', () => {
  const decoded = Result.getOrThrow(decodePlot(JSON.parse(JSON.stringify(spec))));
  const geometry = Result.getOrThrow(compileChecked(decoded));
  expect(geometry.facets[0]?.x?.domain).toEqual([first, last]);
  expect(geometry.facets[0]?.x?.ticks.map(({ label }) => label)).toContain('12:00');
  expect(describePlot(geometry)).toContain('Hour from 12:00 to 14:00');
  expect(describePlot(geometry)).toContain('Latency from 0 ms to 300 ms');
  const tables = plotTables(decoded, geometry);
  expect(tables[0]?.rows).toEqual([
    ['12:00', '120 ms'],
    ['14:00', '240 ms'],
  ]);
  expect(plotHtml(geometry, { tables })).toContain('<td>120 ms</td>');
  expect(plotSvg(geometry)).toContain('>12:00</text>');
});

it('reports invalid formatting options at the spec path', () => {
  const badZone: PlotSpec = {
    ...spec,
    x: { ...spec.x, format: { kind: 'dateTime', timeZone: 'Not/A_Zone' } },
  };
  const issue = Result.getOrThrow(Result.flip(compileChecked(badZone)));
  expect(issue).toMatchObject({ code: 'InvalidPlot', path: 'x.format' });
});
