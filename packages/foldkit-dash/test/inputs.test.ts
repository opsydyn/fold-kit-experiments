import { describe, expect, test } from 'bun:test';

import { Result } from 'effect';

import { drawSpec } from '../src/chart';
import {
  choicesOf,
  defaultsOf,
  filterRows,
  type Input,
  readInput,
  referencesIn,
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
