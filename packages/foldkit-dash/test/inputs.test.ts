import { describe, expect, test } from 'bun:test';

import { Option, Result } from 'effect';

import { choiceAt, drawSpec, pointedAt, spanPixels, targetsOf, valueAtPixel } from '../src/chart';
import {
  choicesOf,
  defaultsOf,
  filterRows,
  type Input,
  queryOf,
  readInput,
  referencesIn,
  valueFor,
  valuesFromQuery,
  withValues,
} from '../src/inputs';
import type { Json, Rows } from '../src/rows';
import { rows } from './support';

const noData = (name: string): Result.Result<Rows, string> => Result.fail(`no ${name}`);
const withData = (name: string): Result.Result<Rows, string> =>
  name === 'units.json' ? Result.succeed(rows) : Result.fail(`no data/${name}`);

const input = (fence: Json, read = noData): Input => {
  const result = readInput(JSON.stringify(fence), read);
  if (Result.isFailure(result)) throw new Error(result.failure);
  return result.success;
};

const refused = (fence: Json, read = noData): string => {
  const result = readInput(JSON.stringify(fence), read);
  return Result.isFailure(result) ? result.failure : 'read';
};

describe('inputs', () => {
  test('a select takes its first option, or all, by default; choices may come from data', () => {
    expect(input({ type: 'select', name: 'region', options: ['north', 'south'] })).toEqual({
      _tag: 'Choose',
      style: 'select',
      name: 'region',
      label: 'region',
      choices: ['north', 'south'],
      all: null,
      value: 'north',
    });
    const all = input({
      type: 'radio',
      name: 'region',
      label: 'Region',
      options: ['a'],
      all: 'Every region',
    });
    expect(all).toMatchObject({
      style: 'radio',
      label: 'Region',
      all: 'Every region',
      value: null,
    });
    expect(choicesOf(all)).toEqual([null, 'a']);
    const fromData = input(
      { type: 'select', name: 'region', options: { data: 'units.json', field: 'region' } },
      withData,
    );
    expect(fromData).toMatchObject({ choices: ['north', 'south'], value: 'north' });
  });

  test('a range starts at its min unless told; a checkbox is off unless told', () => {
    const range = input({ type: 'range', name: 'floor', min: 0, max: 20, step: 5 });
    expect(range).toMatchObject({ _tag: 'Range', value: 0, step: 5 });
    expect(choicesOf(range)).toEqual([0, 20]);
    expect(input({ type: 'checkbox', name: 'smooth' })).toMatchObject({
      _tag: 'Toggle',
      value: false,
    });
    expect(defaultsOf([range, input({ type: 'checkbox', name: 'smooth', value: true })])).toEqual({
      floor: 0,
      smooth: true,
    });
  });

  test('a mistake is named by the field at fault', () => {
    expect(refused({ type: 'select', name: 'r', options: ['a'], value: 'b' })).toBe(
      'value: "b" is not one of the options',
    );
    expect(refused({ type: 'select', name: 'r', options: ['a'], value: null })).toContain('all');
    expect(refused({ type: 'select', name: 'r', options: [] })).toContain('at least one choice');
    expect(refused({ type: 'range', name: 'r', min: 5, max: 1 })).toBe(
      'min: must be less than max',
    );
    expect(refused({ type: 'range', name: 'r', min: 0, max: 1, value: 3 })).toContain('outside');
    expect(
      refused(
        { type: 'select', name: 'r', options: { data: 'units.json', field: 'zone' } },
        withData,
      ),
    ).toBe('options.field: field "zone" is missing from units.json');
    expect(refused({ type: 'select', name: 'r', options: { data: 'x.json', field: 'zone' } })).toBe(
      'no x.json',
    );
    expect(refused({ type: 'slider', name: 'r' })).not.toBe('read');
    expect(refused({ type: 'checkbox', name: '1st' })).not.toBe('read');
  });

  test('references are found and filled in anywhere in a spec', () => {
    const spec = {
      data: 'units.json',
      title: { input: 'title' },
      marks: [{ mark: 'bar', x: 'month', y: { input: 'metric' } }],
      where: { region: { input: 'region' }, units: { min: { input: 'floor' } } },
    };
    expect(referencesIn(spec)).toEqual(['title', 'metric', 'region', 'floor']);
    expect(withValues(spec, { title: 'T', metric: 'units', region: null, floor: 10 })).toEqual({
      data: 'units.json',
      title: 'T',
      marks: [{ mark: 'bar', x: 'month', y: 'units' }],
      where: { region: null, units: { min: 10 } },
    });
    // An object with more than the one key is not a reference.
    expect(referencesIn({ input: 'a', other: 1 })).toEqual([]);
  });

  test('where keeps equal or in-range rows, and null keeps every row', () => {
    const kept = (where: Parameters<typeof filterRows>[1]) =>
      Result.map(filterRows(rows, where), (left) => left.map((row) => row['month']));
    expect(kept({ region: 'north' })).toEqual(Result.succeed(['Jan', 'Mar']));
    expect(kept({ region: null })).toEqual(Result.succeed(['Jan', 'Feb', 'Mar']));
    expect(kept({ units: { min: 10 } })).toEqual(Result.succeed(['Jan', 'Mar']));
    expect(kept({ units: { min: 10, max: 14 } })).toEqual(Result.succeed(['Jan']));
    expect(kept({ zone: 'x' })).toEqual(
      Result.fail('where.zone: field "zone" is missing from the data'),
    );
  });

  test('a chart is drawn at the values given; a filter that keeps nothing says so', () => {
    const data = new Map([['units.json', rows]]);
    const spec = {
      width: 300,
      height: 200,
      data: 'units.json',
      where: { region: { input: 'region' } },
      marks: [{ mark: 'bar', x: 'month', y: 'units' }],
    };
    const months = (region: string | null) =>
      Result.map(drawSpec(spec, data, { region }), ({ plot }) =>
        Array.isArray(plot.data) ? plot.data.map((row) => row['month']) : [],
      );
    expect(months('south')).toEqual(Result.succeed(['Feb']));
    expect(months(null)).toEqual(Result.succeed(['Jan', 'Feb', 'Mar']));
    expect(months('west')).toEqual(
      Result.fail({ kind: 'data', path: null, message: 'where {"region":"west"} keeps no rows' }),
    );
  });
});

describe('several values at once (ADR 0117)', () => {
  const regions = input(
    { type: 'checkboxes', name: 'regions', options: { data: 'units.json', field: 'region' } },
    withData,
  );

  test('checkboxes start with every choice ticked unless told, and refuse a stray value', () => {
    expect(regions).toEqual({
      _tag: 'Pick',
      name: 'regions',
      label: 'regions',
      choices: ['north', 'south'],
      value: ['north', 'south'],
    });
    const some = input({
      type: 'checkboxes',
      name: 'r',
      options: ['a', 'b', 'c'],
      value: ['c', 'a'],
    });
    // Ticked choices keep the options' order.
    expect(some._tag === 'Pick' && some.value).toEqual(['a', 'c']);
    expect(refused({ type: 'checkboxes', name: 'r', options: ['a'], value: ['z'] })).toBe(
      'value: "z" is not one of the options',
    );
    // check tries the default and each choice alone, not none.
    expect(choicesOf(regions)).toEqual([['north', 'south'], ['north'], ['south']]);
  });

  test('a list in where keeps rows matching any of it; an empty list keeps none', () => {
    const kept = (where: Json) =>
      Result.map(filterRows(rows, where), (each) => each.map((row) => row['month']));
    expect(kept({ region: ['north', 'south'] })).toEqual(Result.succeed(['Jan', 'Feb', 'Mar']));
    expect(kept({ region: ['south'] })).toEqual(Result.succeed(['Feb']));
    expect(kept({ region: [] })).toEqual(Result.succeed([]));
  });

  test('the address holds a parameter per ticked choice, and an empty one for none', () => {
    const inputs = [regions];
    expect(queryOf(inputs, { regions: ['north', 'south'] })).toBe('');
    expect(queryOf(inputs, { regions: ['south'] })).toBe('?regions=south');
    expect(queryOf(inputs, { regions: [] })).toBe('?regions=');
    expect(valuesFromQuery(inputs, '?regions=south&regions=west')).toEqual({ regions: ['south'] });
    expect(valuesFromQuery(inputs, '?regions=')).toEqual({ regions: [] });
    expect(valuesFromQuery(inputs, '?other=1')).toEqual({});
    // --at takes a comma-separated list.
    expect(valueFor(regions, 'south, north')).toEqual(Result.succeed(['north', 'south']));
    expect(valueFor(regions, 'west')).toEqual(Result.fail('west is not one of its choices'));
  });
});

describe('choosing a series, and how a series moves (ADR 0117)', () => {
  const weekly = [
    { week: '2026-05-11', units: 9, region: 'north' },
    { week: '2026-05-04', units: 10, region: 'north' },
    { week: '2026-05-18', units: 4, region: 'north' },
    { week: '2026-05-25', units: 12, region: 'north' },
    { week: '2026-05-04', units: 30, region: 'south' },
    { week: '2026-05-11', units: 31, region: 'south' },
    { week: '2026-05-18', units: 32, region: 'south' },
    { week: '2026-05-25', units: 33, region: 'south' },
  ];
  const lines = {
    width: 400,
    height: 240,
    data: 'weekly.json',
    select: 'region',
    marks: [{ mark: 'line', x: 'week', y: 'units', stroke: 'region' }],
  };
  const drawn = Result.getOrThrow(drawSpec(lines, new Map([['weekly.json', weekly]]), {}));

  test('a line chart of several series selects by series', () => {
    expect(drawn.selects).toEqual({
      input: 'region',
      categories: ['north', 'south'],
      by: { _tag: 'Series', field: 'region', x: 'week', y: 'units' },
    });
  });

  test('a press chooses the series of the nearest point, and nothing far from every point', () => {
    const facet = drawn.geometry.facets[0];
    const xAxis = facet?.x ?? null;
    const yAxis = facet?.y ?? null;
    expect(xAxis?.type).toBe('time');
    if (xAxis === null || yAxis === null) return;
    const along = (axis: typeof xAxis, value: number) => {
      const [d0 = 0, d1 = 1] = axis.domain.map(Number);
      return axis.range[0] + ((value - d0) / (d1 - d0)) * (axis.range[1] - axis.range[0]);
    };
    const x = along(xAxis, Date.parse('2026-05-18'));
    expect(choiceAt(drawn, x, along(yAxis, 32) + 3)).toEqual(Option.some('south'));
    expect(choiceAt(drawn, x, along(yAxis, 4) - 3)).toEqual(Option.some('north'));
    expect(choiceAt(drawn, x, along(yAxis, 18))).toEqual(Option.none());
  });

  test('read-outs walk each series along x, and a pointer finds the nearest one', () => {
    const targets = targetsOf(drawn, lines);
    expect(targets.map((target) => target.text)).toEqual([
      'north, week 2026-05-04: units 10',
      'north, week 2026-05-11: units 9',
      'north, week 2026-05-18: units 4',
      'north, week 2026-05-25: units 12',
      'south, week 2026-05-04: units 30',
      'south, week 2026-05-11: units 31',
      'south, week 2026-05-18: units 32',
      'south, week 2026-05-25: units 33',
    ]);
    expect(targets[5]?.choice).toBe('south');
    const sixth = targets[5];
    if (sixth === undefined) return;
    expect(pointedAt(drawn, targets, sixth.x + 3, sixth.y - 3)).toBe(5);
    expect(pointedAt(drawn, targets, sixth.x, sixth.y + 60)).toBeUndefined();
  });

  test('read-outs use the same format as the chart axes', () => {
    const formatted = {
      ...lines,
      x: { format: { kind: 'dateTime', dateStyle: 'short', locale: 'en-GB' } },
      y: { format: { kind: 'unit', unit: 'millisecond', locale: 'en-GB' } },
    };
    const chart = Result.getOrThrow(drawSpec(formatted, new Map([['weekly.json', weekly]]), {}));
    expect(targetsOf(chart, formatted)[0]?.text).toBe('north, week 04/05/2026: units 10 ms');
  });

  test('a series reports its largest fall and rise in date order, not the rows order', () => {
    const [north, south] = drawn.series;
    expect(north?.fall).toEqual({
      from: { x: '2026-05-04', y: 10 },
      to: { x: '2026-05-18', y: 4 },
    });
    expect(north?.rise).toEqual({
      from: { x: '2026-05-18', y: 4 },
      to: { x: '2026-05-25', y: 12 },
    });
    // The climb after the largest fall: from its low to the highest point after it.
    expect(north?.recovery).toEqual({
      from: { x: '2026-05-18', y: 4 },
      to: { x: '2026-05-25', y: 12 },
    });
    // A series that only climbs has no fall.
    expect(south?.fall).toBeUndefined();
    expect(south?.rise).toEqual({
      from: { x: '2026-05-04', y: 30 },
      to: { x: '2026-05-25', y: 33 },
    });
  });
});

describe('a span between two ends (ADR 0119)', () => {
  const weekly = [
    { week: '2026-05-11', units: 9 },
    { week: '2026-05-04', units: 10 },
    { week: '2026-05-25', units: 12 },
  ];
  const fromData = (name: string): Result.Result<Rows, string> =>
    name === 'weekly.json' ? Result.succeed(weekly) : Result.fail(`no data/${name}`);
  const weeks = input(
    { type: 'between', name: 'weeks', options: { data: 'weekly.json', field: 'week' } },
    fromData,
  );

  test('takes its ends from the data, or as written, and starts at the whole span', () => {
    expect(weeks).toEqual({
      _tag: 'Between',
      name: 'weeks',
      label: 'weeks',
      kind: 'date',
      min: '2026-05-04',
      max: '2026-05-25',
      step: 1,
      value: { min: '2026-05-04', max: '2026-05-25' },
    });
    expect(refused({ type: 'between', name: 'n', min: 1, max: '2026-01-01' })).toBe(
      'min: the ends must both be numbers, or both ISO dates',
    );
    expect(
      refused({ type: 'between', name: 'n', min: 0, max: 10, value: { min: 5, max: 20 } }),
    ).toBe('value: 5 to 20 is not within 0 to 10');
  });

  test('a span in where keeps rows between its ends, both included', () => {
    const kept = Result.map(
      filterRows(weekly, { week: { min: '2026-05-05', max: '2026-05-25' } }),
      (each) => each.map((row) => row['week']),
    );
    expect(kept).toEqual(Result.succeed(['2026-05-11', '2026-05-25']));
  });

  test('the address and --at write a span as from..to', () => {
    const span = { min: '2026-05-11', max: '2026-05-18' };
    expect(queryOf([weeks], { weeks: span })).toBe('?weeks=2026-05-11..2026-05-18');
    expect(queryOf([weeks], { weeks: weeks._tag === 'Between' ? weeks.value : span })).toBe('');
    expect(valuesFromQuery([weeks], '?weeks=2026-05-11..2026-05-18')).toEqual({ weeks: span });
    // Ends past the data's are brought to them; a span that misses it is refused.
    expect(valuesFromQuery([weeks], '?weeks=2026-01-01..2026-05-18')).toEqual({
      weeks: { min: '2026-05-04', max: '2026-05-18' },
    });
    expect(valuesFromQuery([weeks], '?weeks=2026-01-01..2026-02-01')).toEqual({});
    expect(valueFor(weeks, '2026-05-18..2026-05-11')).toEqual(
      Result.fail(
        '2026-05-18..2026-05-11 is not a span from..to that meets 2026-05-04..2026-05-25',
      ),
    );
  });

  test('a brush needs an x of numbers or dates; its input is checked on the page', () => {
    const spec = (x: string) => ({
      width: 400,
      height: 240,
      data: 'weekly.json',
      brush: 'weeks',
      marks: [{ mark: x === 'week' ? 'line' : 'bar', x, y: 'units' }],
    });
    const data = new Map([['weekly.json', weekly]]);
    const lines = Result.getOrThrow(drawSpec(spec('week'), data, {}));
    expect(lines.brushes).toBe('weeks');
    // The pixels at the span's ends read back as the same days.
    const [x0 = 0, x1 = 0] = Option.getOrThrow(
      spanPixels(lines, { min: '2026-05-11', max: '2026-05-18' }),
    );
    expect(Option.getOrThrow(valueAtPixel(lines, x0))).toBe('2026-05-11');
    expect(Option.getOrThrow(valueAtPixel(lines, x1))).toBe('2026-05-18');
    const bars = drawSpec(
      { ...spec('week'), marks: [{ mark: 'bar', x: 'week', y: 'units' }], x: { type: 'band' } },
      data,
      {},
    );
    expect(Result.isFailure(bars) && bars.failure.message).toBe(
      'brush: the chart needs an x axis of numbers or dates to drag across',
    );
  });
});

describe('totals of stacked bars (ADR 0119)', () => {
  test('a bar chart stacked by a field ranks each category by its total, first', () => {
    const stacked = [
      { region: 'north', week: 'w1', units: 3 },
      { region: 'north', week: 'w2', units: 4 },
      { region: 'south', week: 'w1', units: 5 },
      { region: 'south', week: 'w2', units: 1 },
    ];
    const drawn = Result.getOrThrow(
      drawSpec(
        {
          width: 400,
          height: 240,
          data: 'stacked.json',
          marks: [{ mark: 'bar', x: 'region', y: 'units', z: 'week', stack: 'zero' }],
        },
        new Map([['stacked.json', stacked]]),
        {},
      ),
    );
    expect(drawn.series[0]).toEqual({
      name: 'total units',
      count: 2,
      low: { y: 6, x: ['south'] },
      high: { y: 7, x: ['north'] },
      ranked: [
        { x: 'north', y: 7 },
        { x: 'south', y: 6 },
      ],
    });
    expect(drawn.series.slice(1).map((series) => series.name)).toEqual(['w1', 'w2']);
  });
});
