import type { Html, HtmlBuilder } from 'foldkit/html';
import type { MountAction } from 'foldkit/mount';

import { describePlot } from '../plot/describe.js';
import type { PlotTable } from '../plot/describe.js';
import { angularLabel, radialLabel, spokeOf } from '../plot/polar.js';
import type {
  FacetGeometry,
  Graphic,
  Legend,
  PlotAxis,
  PlotGeometry,
  PolarGeometry,
} from '../plot/types.js';

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

/**
 * Interaction drawn over a plot without recompiling it, in plot pixels: the
 * parent computes positions from the pointer and passes them in.
 */
export type PlotOverlay = Readonly<{
  /** Lines through a point, across the facet that holds it. */
  crosshair?: Readonly<{ x: number; y: number }>;
  /** A ring around a point, such as the nearest mark under the pointer. */
  ring?: Readonly<{ x: number; y: number; r: number }>;
  /** A band across a facet's full height, such as a brushed range. */
  brush?: Readonly<{ x0: number; x1: number; facet?: string }>;
  color?: string;
}>;

/** Accessible extras: a summary of what the chart shows, and its data as a table. */
type AccessibleOptions = Readonly<{
  /** Add `describePlot`'s plain-language summary to the chart's description. */
  summary?: boolean;
  /** A visually hidden table of the data, such as `plotTable(spec)`. */
  table?: PlotTable;
}>;

export type PlotChartOptions = Readonly<{
  palette?: PlotPalette;
  legend?: boolean;
  overlay?: PlotOverlay;
}> &
  AccessibleOptions;

/** Hidden visually, still read by screen readers. */
const VISUALLY_HIDDEN = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  'white-space': 'nowrap',
  border: '0',
} as const;

/** The chart's description, with the summary after it when asked for. */
const descriptionOf = (geometry: PlotGeometry, options: AccessibleOptions): string =>
  [geometry.description, options.summary === true ? describePlot(geometry) : '']
    .filter((part) => part !== '')
    .join(' ');

/** The data table, visually hidden, with a note when it is cut short. */
function dataTable<M>(h: HtmlBuilder<M>, table: PlotTable | undefined): ReadonlyArray<Html> {
  if (table === undefined || table.headers.length === 0) return [];
  const more = table.total - table.rows.length;
  return [
    h.table(
      [h.Class('plot-data'), h.Style(VISUALLY_HIDDEN)],
      [
        h.caption(
          [],
          [
            more > 0
              ? `${table.caption} (first ${table.rows.length} of ${table.total} rows)`
              : table.caption,
          ],
        ),
        h.thead(
          [],
          [
            h.tr(
              [],
              table.headers.map((header) => h.th([h.Attribute('scope', 'col')], [header])),
            ),
          ],
        ),
        h.tbody(
          [],
          table.rows.map((row) =>
            h.tr(
              [],
              row.map((value, i) =>
                i === 0 ? h.th([h.Attribute('scope', 'row')], [value]) : h.td([], [value]),
              ),
            ),
          ),
        ),
      ],
    ),
  ];
}

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

/** A polar facet's frame: rings, spokes, and labels round the outside. */
function polarFrame<M>(h: HtmlBuilder<M>, p: PolarGeometry, palette: PlotPalette): Html {
  const size = palette.labelSize;
  return h.g(
    [h.Class('plot-polar'), h.FontSize(String(size)), h.AriaHidden(true)],
    [
      h.g(
        [h.Stroke(palette.grid), h.Fill('none')],
        [
          ...p.radii.map((t) => h.circle([h.Cx(n(p.cx)), h.Cy(n(p.cy)), h.R(n(t.radius))], [])),
          ...p.angles.map((t) => {
            const [x1, y1, x2, y2] = spokeOf(p, t.angle);
            return h.line([h.X1(n(x1)), h.Y1(n(y1)), h.X2(n(x2)), h.Y2(n(y2))], []);
          }),
        ],
      ),
      h.circle(
        [h.Cx(n(p.cx)), h.Cy(n(p.cy)), h.R(n(p.outer)), h.Fill('none'), h.Stroke(palette.axis)],
        [],
      ),
      ...p.angles.map((t) => {
        const at = angularLabel(p, t.angle);
        return h.text(
          [
            h.X(n(at.x)),
            h.Y(n(at.y + size / 3)),
            h.TextAnchor(at.anchor),
            h.Fill(palette.mutedText),
          ],
          [t.label],
        );
      }),
      ...p.radii.map((t) =>
        h.text(
          [
            h.X(n(radialLabel(p, t.radius)[0])),
            h.Y(n(radialLabel(p, t.radius)[1])),
            h.Fill(palette.mutedText),
            h.Opacity('0.75'),
          ],
          [t.label],
        ),
      ),
    ],
  );
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
  if (l.kind === 'symbol')
    return h.ul(
      [h.Class('plot-legend'), style, h.AriaLabel(l.label === '' ? 'Legend' : l.label)],
      [
        ...title,
        ...l.entries.map((entry) =>
          h.li(
            [h.Key(entry.key), h.Style({ display: 'flex', 'align-items': 'center', gap: '6px' })],
            [
              h.svg(
                [h.AriaHidden(true), h.ViewBox('-6 -6 12 12'), h.Width('12'), h.Height('12')],
                [h.path([h.D(entry.path), h.Fill(entry.color ?? 'currentColor')], [])],
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

const facetAt = (geometry: PlotGeometry, x: number, y: number): FacetGeometry | undefined =>
  geometry.facets.find(
    (f) => x >= f.plot.left && x <= f.plot.right && y >= f.plot.top && y <= f.plot.bottom,
  );

function overlayMarks<M>(
  h: HtmlBuilder<M>,
  geometry: PlotGeometry,
  overlay: PlotOverlay,
): ReadonlyArray<Html> {
  const colour = overlay.color ?? 'currentColor';
  const parts: Html[] = [];
  if (overlay.brush !== undefined) {
    const { x0, x1 } = overlay.brush;
    const facet = geometry.facets.find((f) => f.key === overlay.brush?.facet) ?? geometry.facets[0];
    if (facet !== undefined)
      parts.push(
        h.rect(
          [
            h.Class('plot-brush'),
            h.X(n(Math.max(facet.plot.left, Math.min(x0, x1)))),
            h.Y(n(facet.plot.top)),
            h.Width(
              n(
                Math.min(facet.plot.right, Math.max(x0, x1)) -
                  Math.max(facet.plot.left, Math.min(x0, x1)),
              ),
            ),
            h.Height(n(facet.plot.height)),
            h.Fill(colour),
            h.FillOpacity('0.12'),
            h.Stroke(colour),
            h.StrokeOpacity('0.5'),
          ],
          [],
        ),
      );
  }
  if (overlay.crosshair !== undefined) {
    const { x, y } = overlay.crosshair;
    const facet = facetAt(geometry, x, y);
    if (facet !== undefined)
      parts.push(
        h.g(
          [
            h.Class('plot-crosshair'),
            h.Stroke(colour),
            h.StrokeOpacity('0.6'),
            h.StrokeDasharray('3 3'),
          ],
          [
            h.line(
              [h.X1(n(x)), h.X2(n(x)), h.Y1(n(facet.plot.top)), h.Y2(n(facet.plot.bottom))],
              [],
            ),
            h.line(
              [h.X1(n(facet.plot.left)), h.X2(n(facet.plot.right)), h.Y1(n(y)), h.Y2(n(y))],
              [],
            ),
          ],
        ),
      );
  }
  if (overlay.ring !== undefined)
    parts.push(
      h.circle(
        [
          h.Class('plot-ring'),
          h.Cx(n(overlay.ring.x)),
          h.Cy(n(overlay.ring.y)),
          h.R(n(overlay.ring.r)),
          h.Fill('none'),
          h.Stroke(colour),
          h.StrokeWidth('2'),
        ],
        [],
      ),
    );
  return parts.length === 0 ? [] : [h.g([h.Class('plot-overlay'), h.AriaHidden(true)], parts)];
}

/**
 * Marks inside a nested SVG viewport over the plot area when the plot clips:
 * the viewport clips without a clipPath id, so many charts share a page safely.
 */
function clipped<M>(
  h: HtmlBuilder<M>,
  clip: boolean,
  facet: FacetGeometry,
  marks: ReadonlyArray<Html>,
): ReadonlyArray<Html> {
  if (!clip) return marks;
  const { left, top, width, height } = facet.plot;
  return [
    h.svg(
      [
        h.Class('plot-clip'),
        h.X(n(left)),
        h.Y(n(top)),
        h.Width(n(width)),
        h.Height(n(height)),
        h.ViewBox(`${n(left)} ${n(top)} ${n(width)} ${n(height)}`),
        h.Overflow('hidden'),
      ],
      marks,
    ),
  ];
}

export function plotChart<M>(
  h: HtmlBuilder<M>,
  geometry: PlotGeometry,
  options: PlotChartOptions = {},
): Html {
  const palette = options.palette ?? currentColorPalette;
  const description = descriptionOf(geometry, options);
  const label = [geometry.title, description].filter((part) => part !== '').join('. ');
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
        ...(facet.polar === null ? [] : [polarFrame(h, facet.polar, palette)]),
        ...(facet.x === null ? [] : [axis(h, facet, facet.x, palette)]),
        ...(facet.y === null ? [] : [axis(h, facet, facet.y, palette)]),
        ...clipped(
          h,
          geometry.clip,
          facet,
          facet.marks.map((mark) =>
            h.g(
              [
                h.Key(`mark-${mark.index}`),
                h.Class(`plot-mark plot-${mark.mark}`),
                ...(mark.mark === 'text' ? [h.FontSize(String(palette.labelSize + 1))] : []),
              ],
              mark.graphics.map((g) => graphic(h, g)),
            ),
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
          ...(description === '' ? [] : [h.desc([], [description])]),
          ...facets,
          ...(options.overlay === undefined ? [] : overlayMarks(h, geometry, options.overlay)),
        ],
      ),
      ...dataTable(h, options.table),
      ...(options.legend === false ? [] : geometry.legends.map((l) => legend(h, l, palette))),
    ],
  );
}

export type PlotCanvasOptions<M> = Readonly<{
  /**
   * Paints the canvas when it enters the DOM: the parent's Mount, which calls
   * `paintCanvas` from canvas/plot with the same geometry. foldkit-viz installs
   * nothing itself.
   */
  onMount: MountAction<M>;
  /** Changes whenever the geometry does, so a new canvas mounts and repaints. */
  key: string;
  palette?: PlotPalette;
  legend?: boolean;
  overlay?: PlotOverlay;
}> &
  AccessibleOptions;

/**
 * A canvas-painted plot for marks too large for SVG, such as dense dot marks,
 * with interaction drawn in an SVG overlay above it. The overlay re-renders on
 * every hover while the canvas, keyed by its geometry, is left alone. The
 * canvas sizes by CSS aspect ratio, not width and height attributes, so a
 * re-render never resets (and so clears) its pixels.
 */
export function plotCanvas<M>(
  h: HtmlBuilder<M>,
  geometry: PlotGeometry,
  options: PlotCanvasOptions<M>,
): Html {
  const palette = options.palette ?? currentColorPalette;
  const label = [geometry.title, descriptionOf(geometry, options)]
    .filter((part) => part !== '')
    .join('. ');
  return h.figure(
    [h.Class('plot plot-canvas'), h.Style({ margin: '0', 'font-family': palette.fontFamily })],
    [
      h.div(
        [h.Style({ position: 'relative', width: '100%', 'max-width': `${geometry.width}px` })],
        [
          h.canvas(
            [
              h.Key(options.key),
              h.Role('img'),
              ...(label === '' ? [] : [h.AriaLabel(label)]),
              h.Style({
                display: 'block',
                width: '100%',
                height: 'auto',
                'aspect-ratio': `${geometry.width} / ${geometry.height}`,
              }),
              h.OnMount(options.onMount),
            ],
            [],
          ),
          h.svg(
            [
              h.Class('plot-canvas-overlay'),
              h.ViewBox(`0 0 ${geometry.width} ${geometry.height}`),
              h.AriaHidden(true),
              h.Style({
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                'pointer-events': 'none',
                overflow: 'visible',
              }),
            ],
            options.overlay === undefined ? [] : overlayMarks(h, geometry, options.overlay),
          ),
        ],
      ),
      ...dataTable(h, options.table),
      ...(options.legend === false ? [] : geometry.legends.map((l) => legend(h, l, palette))),
    ],
  );
}
