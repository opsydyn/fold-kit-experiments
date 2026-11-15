import { compilePlot } from '../plot/compile.js';
import { describePlot, plotTable } from '../plot/describe.js';
import type { PlotChartOptions } from '../plot/render.js';
import type { PlotGeometry, PlotSpec } from '../plot/types.js';
import { plotHtml, plotSvg } from './plot.js';

/**
 * Inline charts in Jupyter notebooks run by a JavaScript kernel: Deno's
 * (`deno jupyter`) and the community Bun kernel both display a cell's value
 * through the method under this symbol, which returns a MIME bundle. The front
 * end shows the richest type it supports: the HTML figure, then the SVG, then
 * the text summary.
 */
export const jupyterDisplay: unique symbol = Symbol.for('Jupyter.display');

export type PlotMimeBundle = Readonly<{
  /** The figure: SVG, legends and a visually hidden data table, in the notebook's text colour. */
  'text/html': string;
  /** The chart alone in concrete colours, for exports and front ends without HTML. */
  'image/svg+xml': string;
  /** What the chart shows, in words. */
  'text/plain': string;
}>;

export type JupyterDisplayable = Readonly<{ [jupyterDisplay]: () => PlotMimeBundle }>;

/** A compiled plot as a MIME bundle, such as for `Deno.jupyter.display(bundle, { raw: true })`. */
export function plotMimeBundle(
  geometry: PlotGeometry,
  options: PlotChartOptions = {},
): PlotMimeBundle {
  const { legend: _legend, table: _table, ...svgOptions } = options;
  return {
    'text/html': plotHtml(geometry, options),
    'image/svg+xml': plotSvg(geometry, svgOptions),
    'text/plain': [geometry.title, describePlot(geometry)].filter((part) => part !== '').join('. '),
  };
}

/**
 * A spec ready to show as a cell's value: compiled now, so a spec error is
 * raised here, with the plain-language summary and the data table on unless
 * the options turn them off.
 *
 * ```ts
 * import { displayPlot } from 'npm:@opsydyn/foldkit-viz/jupyter';
 * displayPlot({ width: 480, height: 300, data, marks: [{ mark: 'dot', x: 'a', y: 'b' }] });
 * ```
 */
export function displayPlot(spec: PlotSpec, options: PlotChartOptions = {}): JupyterDisplayable {
  const bundle = plotMimeBundle(compilePlot(spec), {
    summary: true,
    table: plotTable(spec),
    ...options,
  });
  return { [jupyterDisplay]: () => bundle };
}
