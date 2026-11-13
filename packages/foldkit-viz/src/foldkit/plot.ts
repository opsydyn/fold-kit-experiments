import type { Html, HtmlBuilder } from 'foldkit/html';

import type { FacetGeometry, Graphic, Legend, PlotAxis, PlotGeometry } from '../plot/types.js';

/**
 * Renders compiled plot geometry (ADR 0037) with the parent's builder: one
 * accessible SVG and an HTML legend. Every mark names itself in a native
 * tooltip when its spec gave a title channel, so a pre-rendered plot reads
 * fully without JavaScript.
 */

export type PlotPalette = Readonly<{
  /** Axis labels and facet headings. */
  text: string;
  /** Tick labels. */
  mutedText: string;
  grid: string;
  axis: string;
  fontFamily: string;
  labelSize: number;
}>;

/** Neutral defaults built on currentColor, so a plot follows the page's text colour. */
export const currentColorPalette: PlotPalette = {
  text: 'currentColor',
  mutedText: 'currentColor',
  grid: 'color-mix(in srgb, currentColor 14%, transparent)',
  axis: 'color-mix(in srgb, currentColor 45%, transparent)',
  fontFamily: 'system-ui, sans-serif',
  labelSize: 11,
};

export type PlotChartOptions = Readonly<{ palette?: PlotPalette; legend?: boolean }>;

const n = (value: number): string => String(Math.round(value * 100) / 100);

/**
 * Packed points as SVG: one path of circles per colour (and per dimmed state),
 * so even a large dense mark is a handful of elements. Canvas suits very large
 * marks better; see canvas/plot.
 */
function packedPaths<M>(
  h: HtmlBuilder<M>,
  g: Extract<Graphic, { kind: 'points' }>,
): ReadonlyArray<Html> {
  const groups = new Map<string, string[]>();
  for (let i = 0; i < g.count; i += 1) {
    const r = g.radius instanceof Float64Array ? (g.radius[i] ?? 0) : g.radius;
    const x = g.xs[i] ?? 0,
      y = g.ys[i] ?? 0;
    const group = `${g.paint[i] ?? 0}:${g.dimmed?.[i] ?? 0}`;
    const parts = groups.get(group) ?? [];
    parts.push(
      `M${n(x - r)},${n(y)}a${n(r)},${n(r)} 0 1,0 ${n(2 * r)},0a${n(r)},${n(r)} 0 1,0 ${n(-2 * r)},0`,
    );
    groups.set(group, parts);
  }
  return [...groups].map(([group, parts]) => {
    const [colour = '0', dimmed = '0'] = group.split(':');
    return h.path(
      [
        h.Key(group),
        h.D(parts.join('')),
        h.Fill(g.palette[Number(colour)] ?? 'currentColor'),
        ...(dimmed === '1' ? [h.FillOpacity('0.15')] : []),
      ],
      [],
    );
  });
}

function graphic<M>(h: HtmlBuilder<M>, g: Graphic): Html {
  const tooltip = g.title === undefined ? [] : [h.title([], [g.title])];
  const common = [h.Key(g.key), h.Opacity(n(g.opacity))];
  switch (g.kind) {
    case 'circle':
      return h.circle(
        [
          ...common,
          h.Cx(n(g.cx)),
          h.Cy(n(g.cy)),
          h.R(n(g.r)),
          h.Fill(g.fill),
          h.Stroke(g.stroke),
          h.StrokeWidth(n(g.strokeWidth)),
          ...(g.title === undefined ? [] : [h.AriaLabel(g.title)]),
        ],
        tooltip,
      );
    case 'path':
      return h.path(
        [
          ...common,
          h.D(g.d),
          h.Fill(g.fill),
          h.Stroke(g.stroke),
          h.StrokeWidth(n(g.strokeWidth)),
          ...(g.translate === undefined
            ? []
            : [h.Transform(`translate(${n(g.translate[0])},${n(g.translate[1])})`)]),
        ],
        tooltip,
      );
    case 'rect':
      return h.rect(
        [
          ...common,
          h.X(n(g.x)),
          h.Y(n(g.y)),
          h.Width(n(g.width)),
          h.Height(n(g.height)),
          h.Fill(g.fill),
          h.Stroke(g.stroke),
          ...(g.title === undefined ? [] : [h.AriaLabel(g.title)]),
        ],
        tooltip,
      );
    case 'line':
      return h.line(
        [
          ...common,
          h.X1(n(g.x1)),
          h.Y1(n(g.y1)),
          h.X2(n(g.x2)),
          h.Y2(n(g.y2)),
          h.Stroke(g.stroke),
          h.StrokeWidth(n(g.strokeWidth)),
        ],
        tooltip,
      );
    case 'points':
      return h.g([...common, h.Class('plot-points')], packedPaths(h, g));
    case 'text':
      return h.text(
        [...common, h.X(n(g.x)), h.Y(n(g.y)), h.Fill(g.fill), h.TextAnchor(g.anchor)],
        [g.text],
      );
  }
}

function gridLines<M>(
  h: HtmlBuilder<M>,
  facet: FacetGeometry,
  palette: PlotPalette,
): ReadonlyArray<Html> {
  const { plot } = facet;
  const lines: Html[] = [];
  if (facet.x?.grid)
    for (const t of facet.x.ticks)
      lines.push(
        h.line(
          [h.X1(n(t.position)), h.X2(n(t.position)), h.Y1(n(plot.top)), h.Y2(n(plot.bottom))],
          [],
        ),
      );
  if (facet.y?.grid)
    for (const t of facet.y.ticks)
      lines.push(
        h.line(
          [h.X1(n(plot.left)), h.X2(n(plot.right)), h.Y1(n(t.position)), h.Y2(n(t.position))],
          [],
        ),
      );
  return lines.length === 0
    ? []
    : [h.g([h.Class('plot-grid'), h.Stroke(palette.grid), h.AriaHidden(true)], lines)];
}

function axis<M>(h: HtmlBuilder<M>, facet: FacetGeometry, a: PlotAxis, palette: PlotPalette): Html {
  const { plot } = facet;
  const bottom = a.orientation === 'bottom';
  const size = palette.labelSize;
  return h.g(
    [h.Class(`plot-axis plot-axis-${a.orientation}`), h.FontSize(String(size)), h.AriaHidden(true)],
    [
      h.line(
        bottom
          ? [h.X1(n(plot.left)), h.X2(n(plot.right)), h.Y1(n(plot.bottom)), h.Y2(n(plot.bottom))]
          : [h.X1(n(plot.left)), h.X2(n(plot.left)), h.Y1(n(plot.top)), h.Y2(n(plot.bottom))],
        [],
      ),
      ...a.ticks.map((t) =>
        h.text(
          [
            h.X(n(bottom ? t.position : plot.left - 6)),
            h.Y(n(bottom ? plot.bottom + size + 4 : t.position + size / 3)),
            h.TextAnchor(bottom ? 'middle' : 'end'),
            h.Fill(palette.mutedText),
            h.Opacity('0.75'),
          ],
          [t.label],
        ),
      ),
      ...(a.label === ''
        ? []
        : [
            h.text(
              [
                h.X(n(bottom ? (plot.left + plot.right) / 2 : plot.left)),
                h.Y(n(bottom ? plot.bottom + size * 2 + 10 : plot.top - 6)),
                h.TextAnchor(bottom ? 'middle' : 'start'),
                h.Fill(palette.text),
                h.FontWeight('600'),
              ],
              [a.label],
            ),
          ]),
    ],
  );
}

function legend<M>(h: HtmlBuilder<M>, l: Legend, palette: PlotPalette): Html {
  const style = h.Style({
    display: 'flex',
    'flex-wrap': 'wrap',
    'align-items': 'center',
    gap: '4px 14px',
    margin: '6px 0 0',
    padding: '0',
    'list-style': 'none',
    'font-family': palette.fontFamily,
    'font-size': `${palette.labelSize}px`,
  });
  const title = l.label === '' ? [] : [h.li([h.Style({ 'font-weight': '600' })], [l.label])];
  if (l.kind === 'categorical')
    return h.ul(
      [h.Class('plot-legend'), style, h.AriaLabel(l.label === '' ? 'Legend' : l.label)],
      [
        ...title,
        ...l.entries.map((entry) =>
          h.li(
            [h.Key(entry.key), h.Style({ display: 'flex', 'align-items': 'center', gap: '6px' })],
            [
              h.span(
                [
                  h.AriaHidden(true),
                  h.Style({
                    width: '10px',
                    height: '10px',
                    'border-radius': '2px',
                    background: entry.color,
                  }),
                ],
                [],
              ),
              entry.label,
            ],
          ),
        ),
      ],
    );
  const [lo, hi] = l.domain;
  return h.ul(
    [
      h.Class('plot-legend'),
      style,
      h.AriaLabel(`${l.label === '' ? 'Colour' : l.label}: ${lo} to ${hi}`),
    ],
    [
      ...title,
      h.li([], [String(lo)]),
      h.li(
        [h.AriaHidden(true)],
        [
          h.span(
            [
              h.Style({
                display: 'block',
                width: '120px',
                height: '10px',
                'border-radius': '2px',
                background: `linear-gradient(to right, ${l.stops.join(', ')})`,
              }),
            ],
            [],
          ),
        ],
      ),
      h.li([], [String(hi)]),
    ],
  );
}

export function plotChart<M>(
  h: HtmlBuilder<M>,
  geometry: PlotGeometry,
  options: PlotChartOptions = {},
): Html {
  const palette = options.palette ?? currentColorPalette;
  const label = [geometry.title, geometry.description].filter((part) => part !== '').join('. ');
  const facets = geometry.facets.map((facet) =>
    h.g(
      // Every label in the facet inherits the palette's size unless it sets its own.
      [h.Key(facet.key), h.Class('plot-facet'), h.FontSize(String(palette.labelSize))],
      [
        ...(facet.label === ''
          ? []
          : [
              h.text(
                [
                  // Centred over the panel, a row above the y-axis label.
                  h.X(n((facet.plot.left + facet.plot.right) / 2)),
                  h.Y(n(facet.plot.top - palette.labelSize - 10)),
                  h.TextAnchor('middle'),
                  h.FontSize(String(palette.labelSize + 1)),
                  h.FontWeight('600'),
                  h.Fill(palette.text),
                ],
                [facet.label],
              ),
            ]),
        ...gridLines(h, facet, palette),
        ...(facet.x === null ? [] : [axis(h, facet, facet.x, palette)]),
        ...(facet.y === null ? [] : [axis(h, facet, facet.y, palette)]),
        ...facet.marks.map((mark) =>
          h.g(
            [
              h.Key(`mark-${mark.index}`),
              h.Class(`plot-mark plot-${mark.mark}`),
              ...(mark.mark === 'text' ? [h.FontSize(String(palette.labelSize + 1))] : []),
            ],
            mark.graphics.map((g) => graphic(h, g)),
          ),
        ),
      ],
    ),
  );
  return h.figure(
    [h.Class('plot'), h.Style({ margin: '0', 'font-family': palette.fontFamily })],
    [
      h.svg(
        [
          h.ViewBox(`0 0 ${geometry.width} ${geometry.height}`),
          h.Width('100%'),
          h.Style({
            display: 'block',
            'max-width': `${geometry.width}px`,
            height: 'auto',
            overflow: 'visible',
          }),
          h.Role('img'),
          ...(label === '' ? [] : [h.AriaLabel(label)]),
        ],
        [
          ...(geometry.title === '' ? [] : [h.title([], [geometry.title])]),
          ...(geometry.description === '' ? [] : [h.desc([], [geometry.description])]),
          ...facets,
        ],
      ),
      ...(options.legend === false ? [] : geometry.legends.map((l) => legend(h, l, palette))),
    ],
  );
}
