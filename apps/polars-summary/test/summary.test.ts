import { describe, expect, it } from 'bun:test';

import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import type { ColumnTable } from '@opsydyn/foldkit-viz/plot';
import schema from '@opsydyn/foldkit-viz/plot-spec.schema.json';
import Ajv from 'ajv';

import { requestColumns, requestFrame } from '../src/requests';
import { densityGrid, densitySpec, histogramSpec, latencyHistogram } from '../src/summary';
import type { SummaryOptions } from '../src/summary';

const COUNT = 20_000;
const frame = requestFrame(COUNT);
const { latency, payload } = requestColumns(COUNT);

const validate = new Ajv({ allErrors: true }).compile(schema);
/** Errors for a spec sent as JSON text, as another service would send it. */
const errorsOf = (json: string): ReadonlyArray<string> =>
  validate(JSON.parse(json))
    ? []
    : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);

const numbers = (table: ColumnTable, name: string): ReadonlyArray<number> =>
  Array.from(table.columns[name] ?? [], Number);

/** Counts by key, computed in plain JavaScript as the reference. */
function referenceCounts(keyOf: (i: number) => string | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < COUNT; i += 1) {
    const key = keyOf(i);
    if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const cases: ReadonlyArray<SummaryOptions> = [
  { binWidth: 50, maxLatency: 3_000 },
  { binWidth: 7, maxLatency: 500 },
  { binWidth: 250, maxLatency: 20_000 },
];

describe('latencyHistogram', () => {
  it.each(cases)('counts each bin as plain JavaScript does: %o', (options) => {
    const bins = latencyHistogram(frame, options);
    const x1 = numbers(bins, 'x1'),
      x2 = numbers(bins, 'x2'),
      count = numbers(bins, 'count');
    const counted = new Map(x1.map((start, i) => [String(start), count[i] ?? 0]));
    const expected = referenceCounts((i) => {
      const value = latency[i] ?? 0;
      return value <= options.maxLatency
        ? String(Math.floor(value / options.binWidth) * options.binWidth)
        : undefined;
    });
    expect(counted).toEqual(expected);
    expect(x2).toEqual(x1.map((start) => start + options.binWidth));
    expect([...x1].sort((a, b) => a - b)).toEqual([...x1]);
  });
});

describe('densityGrid', () => {
  it('counts each latency and payload cell as plain JavaScript does', () => {
    const options = cases[0] ?? { binWidth: 50, maxLatency: 3_000 };
    const cells = densityGrid(frame, options);
    const x1 = numbers(cells, 'x1'),
      y1 = numbers(cells, 'y1'),
      count = numbers(cells, 'count');
    const counted = new Map(x1.map((x, i) => [`${x},${y1[i]}`, count[i] ?? 0]));
    const expected = referenceCounts((i) => {
      const value = latency[i] ?? 0;
      if (value > options.maxLatency) return undefined;
      return `${Math.floor(value / options.binWidth) * options.binWidth},${Math.floor((payload[i] ?? 0) / 10) * 10}`;
    });
    expect(counted).toEqual(expected);
    // Polars' log can differ from Math.log10 in the last bit.
    const shade = numbers(cells, 'shade');
    expect(count.every((n, i) => Math.abs((shade[i] ?? Number.NaN) - Math.log10(n)) < 1e-12)).toBe(
      true,
    );
  });
});

describe('the specs the server sends', () => {
  const options = { binWidth: 50, maxLatency: 3_000 };
  const specs = [
    ['histogram', histogramSpec(latencyHistogram(frame, options), options)],
    ['density grid', densitySpec(densityGrid(frame, options), options)],
  ] as const;

  it.each(specs)('the %s is plain JSON, valid under the published schema', (_, spec) => {
    const json = JSON.stringify(spec);
    expect(JSON.parse(json)).toEqual(spec);
    expect(errorsOf(json)).toEqual([]);
  });

  it.each(specs)('the %s compiles, as JSON, to a few hundred shapes at most', (_, spec) => {
    const geometry = compilePlot(JSON.parse(JSON.stringify(spec)));
    const graphics = geometry.facets[0]?.marks[0]?.graphics ?? [];
    expect(graphics.length).toBeGreaterThan(10);
    expect(graphics.length).toBeLessThan(2_000);
  });
});
