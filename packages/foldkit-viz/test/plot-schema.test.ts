import { describe, expect, it } from 'bun:test';

import Ajv from 'ajv';

import schema from '../schema/plot-spec.schema.json';
import { compilePlot } from '../src/plot';
import type { PlotSpec } from '../src/plot';

/**
 * The published JSON Schema for PlotSpec: programs in other languages check a
 * spec against it before plotting. tools/plot-schema.ts generates it from the
 * types, and the `schema-check` task fails when the two differ.
 */

const validate = new Ajv({ allErrors: true }).compile(schema);
/** Errors for a spec sent as JSON text, as another program would send it. */
const errorsOf = (json: string): ReadonlyArray<string> =>
  validate(JSON.parse(json))
    ? []
    : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);

const bars = {
  width: 400,
  height: 240,
  data: [
    { month: 'Jan', units: 1200 },
    { month: 'Feb', units: 980 },
  ],
  marks: [{ mark: 'bar', x: 'month', y: 'units', fill: { value: '#6366f1' } }],
} satisfies PlotSpec;

describe('the plot spec schema', () => {
  it('accepts a spec, which compiles', () => {
    expect(errorsOf(JSON.stringify(bars))).toEqual([]);
    expect(() => compilePlot(JSON.parse(JSON.stringify(bars)))).not.toThrow();
  });

  it('accepts a $schema key, which editors use and compilePlot ignores', () => {
    const spec = { $schema: schema.$id, ...bars };
    expect(errorsOf(JSON.stringify(spec))).toEqual([]);
    expect(() => compilePlot(spec)).not.toThrow();
  });

  it('accepts a column table as JSON writes one, with plain arrays', () => {
    const spec = {
      width: 400,
      height: 240,
      data: { length: 3, columns: { x: [1, 2, 3], y: [3, null, 2] } },
      marks: [{ mark: 'dot', x: 'x', y: 'y', dense: true }],
    } satisfies PlotSpec;
    expect(errorsOf(JSON.stringify(spec))).toEqual([]);
    expect(() => compilePlot(spec)).not.toThrow();
  });

  it('accepts marks, transforms, facets and scales together', () => {
    const spec = {
      width: 600,
      height: 300,
      data: [{ t: '2026-01-01', v: 3, g: 'a' }],
      facet: { x: 'g' },
      x: { type: 'time' },
      color: { scheme: 'tableau10' },
      marks: [
        { mark: 'line', x: 't', y: 'v', stroke: 'g', transform: { type: 'loess', bandwidth: 0.4 } },
        { mark: 'rule', y: { value: 0 } },
        { mark: 'rect', x: 'v', transform: { type: 'bin', thresholds: 10 } },
      ],
    };
    expect(errorsOf(JSON.stringify(spec))).toEqual([]);
  });

  it('rejects what compilePlot rejects: an unknown mark, key or channel type', () => {
    expect(errorsOf(JSON.stringify({ ...bars, marks: [{ mark: 'pie', x: 'month' }] }))).not.toEqual(
      [],
    );
    expect(
      errorsOf(
        JSON.stringify({
          ...bars,
          marks: [{ mark: 'bar', x: 'month', y: 'units', colour: 'red' }],
        }),
      ),
    ).not.toEqual([]);
    expect(
      errorsOf(JSON.stringify({ ...bars, marks: [{ mark: 'bar', x: 'month', y: 4 }] })),
    ).not.toEqual([]);
    expect(errorsOf(JSON.stringify({ ...bars, width: '400' }))).not.toEqual([]);
    expect(errorsOf(JSON.stringify({ ...bars, color: { scheme: 'Tableau10' } }))).not.toEqual([]);
  });

  it('catches a misspelt top-level key, which compilePlot would ignore', () => {
    const { height, ...rest } = bars;
    expect(errorsOf(JSON.stringify({ ...rest, heigth: height }))).not.toEqual([]);
  });

  it('describes a column as a JSON array, not as a typed array object', () => {
    expect(schema.definitions.Column).toEqual({
      type: 'array',
      items: { $ref: '#/definitions/Value' },
      description: expect.stringContaining('typed array'),
    });
    expect(JSON.stringify(schema)).not.toContain('Make all properties in T');
  });
});
