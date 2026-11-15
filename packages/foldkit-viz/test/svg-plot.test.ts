import { describe, expect, it } from 'bun:test';

import { plotChart } from '../src/foldkit/plot.js';
import { compilePlot, plotTable } from '../src/plot/index.js';
import type { PlotSpec } from '../src/plot/index.js';
import { currentColorPalette, plotHtml, plotSvg, svgPalette } from '../src/svg/plot.js';
import { renderChart } from './render-chart.js';

const rows = [
  { dose: 1, response: 2, group: 'control <a>' },
  { dose: 2, response: 4, group: 'treated & "b"' },
  { dose: 3, response: 3, group: 'control <a>' },
];

const specs: ReadonlyArray<readonly [string, PlotSpec]> = [
  [
    'dots, a rule, a title channel and escaped text',
    {
      width: 400,
      height: 260,
      title: 'Dose > response & "more"',
      description: 'Three <observations>',
      data: rows,
      marks: [
        { mark: 'dot', x: 'dose', y: 'response', fill: 'group', title: 'group' },
        { mark: 'rule', y: { value: 3 } },
      ],
    },
  ],
  [
    'facets, lines and a clipped domain',
    {
      width: 480,
      height: 240,
      data: rows,
      facet: { x: 'group' },
      y: { domain: [0, 3] },
      marks: [{ mark: 'line', x: 'dose', y: 'response' }],
    },
  ],
  [
    'a polar chart with a continuous colour legend',
    {
      width: 300,
      height: 300,
      data: rows,
      coordinates: 'polar',
      marks: [{ mark: 'bar', x: 'group', y: 'response', fill: 'dose' }],
    },
  ],
];

const element = (markup: string, tag: string): string => {
  const start = markup.indexOf(`<${tag}`);
  const end = markup.lastIndexOf(`</${tag}>`);
  return markup.slice(start, end + tag.length + 3);
};

describe('plotHtml', () => {
  for (const [name, spec] of specs)
    it(`matches FoldKit's render of plotChart byte for byte: ${name}`, async () => {
      const geometry = compilePlot(spec);
      const options = {
        table: plotTable(spec),
        summary: true,
        overlay: { ring: { x: 60, y: 60, r: 8 } },
      };
      const html = await renderChart<never>((h) => plotChart(h, geometry, options));
      expect(plotHtml(geometry, options)).toBe(element(html, 'figure'));
    });

  it('follows the page colour by default', () => {
    const html = plotHtml(compilePlot(specs[0]![1]));
    expect(html).toContain(`stroke="${currentColorPalette.grid}"`);
    expect(html).toContain('class="plot-legend"');
  });
});

describe('plotSvg', () => {
  const geometry = compilePlot(specs[0]![1]);
  const svg = plotSvg(geometry);

  it('is a standalone SVG document at the plot size', () => {
    expect(
      svg.startsWith(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="400" height="260"',
      ),
    ).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toContain('<figure');
    expect(svg).not.toContain('<ul');
    expect(svg).not.toContain('width="100%"');
  });

  it('paints in concrete colours, since image renderers resolve neither the page colour nor color-mix', () => {
    expect(svg).toContain(`color="${svgPalette.text}"`);
    expect(svg).toContain(`font-family="${svgPalette.fontFamily}"`);
    expect(svg).toContain(`stroke="${svgPalette.grid}"`);
    expect(svg).not.toContain('color-mix');
  });

  it('keeps the accessible name, description and escaped text', () => {
    expect(svg).toContain('role="img"');
    expect(svg).toContain('<title>Dose &gt; response &amp; "more"</title>');
    expect(svg).toContain('<desc>Three &lt;observations&gt;</desc>');
    expect(svg).toContain(
      'aria-label="Dose > response &amp; &quot;more&quot;. Three &lt;observations>"',
    );
    expect(svg).toContain('<title>treated &amp; "b"</title>');
  });

  it('adds the plain-language summary when asked', () => {
    expect(plotSvg(geometry, { summary: true })).toContain('Shows 3 points, 1 rule.');
  });

  it('takes a palette, leaving currentColor to the host', () => {
    const themed = plotSvg(geometry, { palette: currentColorPalette });
    expect(themed).not.toContain(' color="');
    expect(themed).toContain('color-mix');
  });

  it('has balanced tags', () => {
    const opened = [...svg.matchAll(/<([a-z]+)[\s>]/g)].map((m) => m[1]);
    const closed = [...svg.matchAll(/<\/([a-z]+)>/g)].map((m) => m[1]);
    expect([...closed].sort()).toEqual([...opened].sort());
  });
});
