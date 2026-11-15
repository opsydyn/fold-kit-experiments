import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import schema from '@opsydyn/foldkit-viz/plot-spec.schema.json';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import * as comparison from './comparison/data';
import * as explore from './explore/charts';
import * as histogramBrush from './histogram-brush/charts';
import * as linkedCharts from './linked-charts/model';
import { examples } from './plot-grammar/specs';
import { chartsFor, samplePoints } from './request-diagnostics/model';
import { initialModel as choroplethModel } from './zoomable-choropleth/model';
import { zoomedSpec } from './zoomable-choropleth/view';
import { priceSpec } from './zoomable-line/spec';

/**
 * Every plot spec this app draws is plain JSON and valid under the JSON Schema
 * that foldkit-viz publishes: what a Rust or Python program writing the same
 * chart would have to send.
 */

const validate = new Ajv({ allErrors: true }).compile(schema);
/** Errors for a spec sent as JSON text, as another program would send it. */
const errorsOf = (json: string): ReadonlyArray<string> =>
  validate(JSON.parse(json))
    ? []
    : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);

/** A value shaped like a plot spec: what a gallery module exports. */
const isSpec = (value: unknown): value is PlotSpec =>
  typeof value === 'object' && value !== null && 'marks' in value && 'width' in value;

const gallery = import.meta.glob('./*/spec.ts', { eager: true });
const range = [100, 400] as const;

/** Gallery modules that export a function of the view, called here for each view. */
const views = new Map([['./zoomable-line/spec.ts', [priceSpec(null), priceSpec(range)]]]);

/** Each spec a gallery module exports: a spec, an array of them, or one per view above. */
const fromGallery = Object.entries(gallery).flatMap(([path, module]) =>
  // Object() gives a module namespace's exports by name; isSpec checks each value.
  Object.entries(Object(module))
    .flatMap(([name, value]): ReadonlyArray<readonly [string, PlotSpec]> => {
      if (isSpec(value)) return [[name, value]];
      if (Array.isArray(value) && value.every(isSpec))
        return value.map((spec, i) => [`${name}[${i}]`, spec]);
      return [];
    })
    .concat((views.get(path) ?? []).map((spec, i) => [`view ${i}`, spec]))
    .map(([name, spec]): readonly [string, PlotSpec] => [`${path} ${name}`, spec]),
);

const charts = chartsFor(samplePoints);
const specs: ReadonlyArray<readonly [string, PlotSpec]> = [
  ...fromGallery,
  ...examples.map(({ title, spec }): readonly [string, PlotSpec] => [
    `plot grammar: ${title}`,
    spec,
  ]),
  ['comparison scatter', comparison.scatterSpec],
  ['comparison histogram', comparison.histogramSpec],
  ['linked charts scatter', linkedCharts.scatterSpec],
  ['linked charts histogram', linkedCharts.histogramSpec],
  ['explore scatter', explore.scatterSpec(null)],
  ['explore scatter, zoomed', explore.scatterSpec(range)],
  ['explore histogram', explore.histogramSpec(null)],
  ['explore histogram, brushed', explore.histogramSpec(range)],
  ['histogram brush histogram', histogramBrush.histogramSpec(null)],
  ['histogram brush histogram, brushed', histogramBrush.histogramSpec(range)],
  ['histogram brush scatter, brushed', histogramBrush.scatterSpec(range)],
  ['zoomable choropleth', zoomedSpec(choroplethModel)],
  ['request diagnostics histogram', charts.histogram.spec],
  ['request diagnostics scatter', charts.scatter.spec],
];

/** /explore's specs carry a million rows; comparing them whole takes seconds under load. */
const SPEC_TIMEOUT = 60_000;

describe('every plot spec the app draws', () => {
  it.each(specs)(
    '%s is plain JSON',
    (_, spec) => {
      expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
    },
    SPEC_TIMEOUT,
  );

  it.each(specs)(
    '%s is valid under the published schema',
    (_, spec) => {
      expect(errorsOf(JSON.stringify(spec))).toEqual([]);
    },
    SPEC_TIMEOUT,
  );

  it('includes a spec from every gallery module', () => {
    const covered = new Set(fromGallery.map(([name]) => name.split(' ')[0]));
    expect(Object.keys(gallery).filter((path) => !covered.has(path))).toEqual([]);
    expect(Object.keys(gallery).length).toBeGreaterThan(40);
  });
});
