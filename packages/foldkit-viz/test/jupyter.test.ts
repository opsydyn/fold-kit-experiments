import { describe, expect, it } from 'bun:test';

import { darkTheme, lightTheme } from '../src/chart/theme.js';
import { compilePlot, describePlot, plotTable } from '../src/plot/index.js';
import type { PlotSpec } from '../src/plot/index.js';
import { displayPlot, jupyterDisplay, plotMimeBundle } from '../src/svg/jupyter.js';
import { plotHtml, plotSvg } from '../src/svg/plot.js';

const spec: PlotSpec = {
  width: 360,
  height: 220,
  title: 'Dose response',
  data: [
    { dose: 1, response: 2, group: 'control' },
    { dose: 2, response: 4, group: 'treated' },
  ],
  marks: [{ mark: 'dot', x: 'dose', y: 'response', fill: 'group' }],
};

describe('plotMimeBundle', () => {
  const geometry = compilePlot(spec);
  const bundle = plotMimeBundle(geometry, { summary: true });

  it('offers the figure as HTML, the chart as SVG and its summary as text', () => {
    expect(bundle['text/html']).toBe(plotHtml(geometry, { summary: true }));
    expect(bundle['image/svg+xml']).toBe(plotSvg(geometry, { summary: true }));
    expect(bundle['text/plain']).toBe(`Dose response. ${describePlot(geometry)}`);
  });

  it('themes both pictures when asked: the figure on its own background, the SVG in the same colours', () => {
    const dark = plotMimeBundle(geometry, { theme: 'dark', legend: false });
    expect(dark['text/html']).toBe(plotHtml(geometry, { theme: 'dark', legend: false }));
    expect(dark['text/html']).toContain(`background: ${darkTheme.background}`);
    expect(dark['image/svg+xml']).toBe(plotSvg(geometry, { theme: 'dark', legend: false }));
    expect(dark['image/svg+xml']).toContain(`color="${darkTheme.text}"`);
  });

  it('follows the notebook in HTML, and paints the SVG in the light theme, by default', () => {
    expect(bundle['text/html']).toStartWith(
      '<figure class="plot" style="margin: 0; font-family: system-ui, sans-serif">',
    );
    expect(bundle['image/svg+xml']).toContain(`fill="${lightTheme.background}"`);
  });

  it('names the chart in text even without a title', () => {
    const untitled = compilePlot({ ...spec, title: '' });
    expect(plotMimeBundle(untitled)['text/plain']).toBe(describePlot(untitled));
  });
});

describe('displayPlot', () => {
  it('uses the symbol the Deno and Bun kernels look for', () => {
    expect<symbol>(jupyterDisplay).toBe(Symbol.for('Jupyter.display'));
  });

  it('compiles the spec and shows it with its summary and data table', () => {
    const shown = displayPlot(spec);
    const bundle = shown[jupyterDisplay]();
    expect(bundle).toEqual(
      plotMimeBundle(compilePlot(spec), { summary: true, table: plotTable(spec) }),
    );
    expect(bundle['text/html']).toContain('<table class="plot-data"');
    expect(bundle['text/html']).toContain('Shows 2 points.');
  });

  it('lets options override the defaults', () => {
    const bundle = displayPlot(spec, { summary: false, legend: false })[jupyterDisplay]();
    expect(bundle['text/html']).not.toContain('Shows 2 points.');
    expect(bundle['text/html']).not.toContain('plot-legend');
  });

  it('builds its bundle once, so a spec error surfaces where displayPlot is called', () => {
    const shown = displayPlot(spec);
    expect(shown[jupyterDisplay]()).toBe(shown[jupyterDisplay]());
  });
});
