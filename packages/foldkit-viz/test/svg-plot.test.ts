import { describe, expect, it } from 'bun:test';

import {
  darkTheme,
  highContrastDarkTheme,
  highContrastLightTheme,
  lightTheme,
} from '../src/chart/theme.js';
import { plotChart } from '../src/foldkit/plot.js';
import { compilePlot, plotTable } from '../src/plot/index.js';
import type { PlotSpec } from '../src/plot/index.js';
import { currentColorPalette, plotHtml, plotSvg } from '../src/svg/plot.js';
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

  it('paints an explicitly themed figure on its own background, in its own text colour', () => {
    const html = plotHtml(compilePlot(specs[0]![1]), { theme: 'high-contrast-dark' });
    expect(html).toStartWith(
      `<figure class="plot" style="margin: 0; font-family: ${highContrastDarkTheme.fontFamily}; background: ${highContrastDarkTheme.background}; color: ${highContrastDarkTheme.text}; padding: 12px; border-radius: 6px">`,
    );
    expect(html).toContain(`stroke="${highContrastDarkTheme.grid}"`);
  });

  it('rejects a theme name it does not know, naming the themes', () => {
    // SAFETY: a name read from JSON or Python is only a string; this one is deliberately unknown.
    const theme = JSON.parse('"sepia"') as 'light';
    expect(() => plotHtml(compilePlot(specs[0]![1]), { theme })).toThrow(
      'theme: "sepia" is not one of light, dark, high-contrast-light, high-contrast-dark',
    );
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
  const sizeOf = (markup: string) =>
    /viewBox="0 0 (\d+) (\d+)" width="(\d+)" height="(\d+)"/.exec(markup)?.slice(1).map(Number);

  it('is a standalone SVG document as wide as the plot', () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toContain('<figure');
    expect(svg).not.toContain('<ul');
    expect(svg).not.toContain('width="100%"');
  });

  it('draws its legend below the plot, growing to fit it', () => {
    const [w, h, width, height] = sizeOf(svg) ?? [];
    expect([w, width]).toEqual([400, 400]);
    expect(h).toBeGreaterThan(260);
    expect(height).toBe(h);
    expect(svg).toContain('class="plot-legend"');
    expect(svg).toContain('>control &lt;a&gt;</text>');
    expect(sizeOf(plotSvg(geometry, { legend: false }))?.[1]).toBe(260);
    expect(plotSvg(geometry, { legend: false })).not.toContain('plot-legend');
  });

  it('paints the light theme by default, since image renderers resolve neither the page colour nor color-mix', () => {
    expect(svg).toContain(`color="${lightTheme.text}"`);
    expect(svg).toContain(`font-family="${lightTheme.fontFamily}"`);
    expect(svg).toContain(`stroke="${lightTheme.grid}"`);
    expect(svg).not.toContain('color-mix');
  });

  it("paints the theme's background behind everything, unless asked not to", () => {
    expect(svg).toMatch(
      /<\/desc><rect x="0" y="0" width="400" height="\d+" fill="#ffffff" class="plot-background"><\/rect>/,
    );
    expect(plotSvg(geometry, { background: false })).not.toContain('plot-background');
  });

  it('takes a theme by name or as an object', () => {
    const dark = plotSvg(geometry, { theme: 'dark' });
    expect(dark).toContain(`fill="${darkTheme.background}"`);
    expect(dark).toContain(`color="${darkTheme.text}"`);
    expect(plotSvg(geometry, { theme: highContrastDarkTheme })).toContain(
      `stroke="${highContrastDarkTheme.grid}"`,
    );
    expect(plotSvg(geometry, { theme: 'high-contrast-light' })).toContain(
      `font-size="${highContrastLightTheme.labelSize}"`,
    );
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

  it('takes the page palette, leaving colour and background to the host', () => {
    const themed = plotSvg(geometry, { theme: currentColorPalette });
    expect(themed).not.toContain(' color="');
    expect(themed).not.toContain('plot-background');
    expect(themed).toContain('color-mix');
  });

  it('draws continuous and symbol legends too', () => {
    const polar = plotSvg(compilePlot(specs[2]![1]));
    expect(polar.match(/<rect [^>]*class="plot-legend-band"/g)?.length).toBeGreaterThan(10);
    const symbols = plotSvg(
      compilePlot({
        width: 300,
        height: 200,
        data: rows,
        marks: [{ mark: 'dot', x: 'dose', y: 'response', symbol: 'group' }],
      }),
    );
    expect(symbols).toMatch(
      /<path d="M[^"]+" transform="translate\([\d.]+,[\d.]+\)" fill="currentColor"><\/path>/,
    );
  });

  it('has balanced tags', () => {
    for (const markup of [svg, plotSvg(compilePlot(specs[2]![1]))]) {
      const opened = [...markup.matchAll(/<([a-z]+)[\s>]/g)].map((m) => m[1]);
      const closed = [...markup.matchAll(/<\/([a-z]+)>/g)].map((m) => m[1]);
      expect([...closed].sort()).toEqual([...opened].sort());
    }
  });
});
