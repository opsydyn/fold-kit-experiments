import { standaloneLegends } from '../plot/legend.js';
import type { LegendLayout } from '../plot/legend.js';
import { currentColorPalette, n, plotFigure, plotGraphic } from '../plot/render.js';
import type { PlotBuilder, PlotChartOptions, PlotOverlay, PlotPalette } from '../plot/render.js';
import { paletteOf } from '../plot/theme.js';
import type { PlotTheme } from '../plot/theme.js';
import type { PlotGeometry } from '../plot/types.js';

/**
 * Compiled plot geometry (ADR 0037) as markup strings, with no framework and
 * no DOM: for files, server responses, notebooks and image pipelines. The
 * markup comes from plot/render, the renderer effect-ui/plot uses, so a page and
 * an export always draw the same chart.
 */

type MarkupAttribute =
  | Readonly<{ kind: 'attribute'; name: string; value: string }>
  | Readonly<{ kind: 'class'; value: string }>
  | Readonly<{ kind: 'style'; value: Record<string, string> }>
  | Readonly<{ kind: 'key' }>;

/** Serialised markup, kept apart from text children so only text is escaped. */
type Markup = Readonly<{ markup: string }>;

const escapeText = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// '>' may stand unescaped in an attribute value, in HTML and XML alike, and FoldKit leaves it.
const escapeAttribute = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

const attributesOf = (attributes: ReadonlyArray<MarkupAttribute>): string => {
  const plain: string[] = [];
  const classes: string[] = [];
  const styles: string[] = [];
  for (const attribute of attributes)
    switch (attribute.kind) {
      case 'attribute':
        plain.push(` ${attribute.name}="${escapeAttribute(attribute.value)}"`);
        break;
      case 'class':
        classes.push(attribute.value);
        break;
      case 'style':
        for (const [property, value] of Object.entries(attribute.value))
          styles.push(`${property}: ${value}`);
        break;
      case 'key':
        break;
    }
  // Attributes, then class, then style: the order FoldKit's server render writes.
  return [
    ...plain,
    ...(classes.length === 0 ? [] : [` class="${escapeAttribute(classes.join(' '))}"`]),
    ...(styles.length === 0 ? [] : [` style="${escapeAttribute(styles.join('; '))}"`]),
  ].join('');
};

/** A builder child is text, which needs escaping, or markup already built: FoldKit's own split. */
const isText = (child: Markup | string): child is string => typeof child === 'string';

const element =
  (tag: string) =>
  (
    attributes: ReadonlyArray<MarkupAttribute>,
    children: ReadonlyArray<Markup | string>,
  ): Markup => ({
    markup: `<${tag}${attributesOf(attributes)}>${children
      .map((child) => (isText(child) ? escapeText(child) : child.markup))
      .join('')}</${tag}>`,
  });

const attribute =
  (name: string) =>
  (value: string): MarkupAttribute => ({ kind: 'attribute', name, value });

const markupBuilder: PlotBuilder<MarkupAttribute, Markup> = {
  caption: element('caption'),
  circle: element('circle'),
  desc: element('desc'),
  div: element('div'),
  figure: element('figure'),
  g: element('g'),
  li: element('li'),
  line: element('line'),
  path: element('path'),
  rect: element('rect'),
  span: element('span'),
  svg: element('svg'),
  table: element('table'),
  tbody: element('tbody'),
  td: element('td'),
  text: element('text'),
  th: element('th'),
  thead: element('thead'),
  title: element('title'),
  tr: element('tr'),
  ul: element('ul'),
  AriaLabel: attribute('aria-label'),
  Class: (value) => ({ kind: 'class', value }),
  Cx: attribute('cx'),
  Cy: attribute('cy'),
  D: attribute('d'),
  Fill: attribute('fill'),
  FillOpacity: attribute('fill-opacity'),
  FontSize: attribute('font-size'),
  FontWeight: attribute('font-weight'),
  Height: attribute('height'),
  Key: () => ({ kind: 'key' }),
  Opacity: attribute('opacity'),
  Overflow: attribute('overflow'),
  R: attribute('r'),
  Role: attribute('role'),
  Stroke: attribute('stroke'),
  StrokeDasharray: attribute('stroke-dasharray'),
  StrokeOpacity: attribute('stroke-opacity'),
  StrokeWidth: attribute('stroke-width'),
  TextAnchor: attribute('text-anchor'),
  Transform: attribute('transform'),
  ViewBox: attribute('viewBox'),
  Width: attribute('width'),
  X: attribute('x'),
  X1: attribute('x1'),
  X2: attribute('x2'),
  Y: attribute('y'),
  Y1: attribute('y1'),
  Y2: attribute('y2'),
  AriaHidden: (value) => ({ kind: 'attribute', name: 'aria-hidden', value: String(value) }),
  Attribute: (name, value) => ({ kind: 'attribute', name, value }),
  Style: (value) => ({ kind: 'style', value }),
};

export type PlotSvgOptions = Omit<PlotChartOptions, 'palette' | 'table' | 'tables'> &
  Readonly<{
    /** Default `'light'`: concrete colours, since an image has no page colour to inherit. */
    theme?: PlotTheme;
    /** Paint the theme's background behind the chart. Default true. */
    background?: boolean;
  }>;

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** A laid-out legend as SVG, for a standalone chart. */
function legendGraphics<A, N>(h: PlotBuilder<A, N>, layout: LegendLayout, palette: PlotPalette): N {
  return h.g(
    [h.Class('plot-legend'), h.FontSize(String(palette.labelSize)), h.AriaHidden(true)],
    layout.marks.map((mark) => {
      switch (mark.kind) {
        case 'swatch':
          return h.rect(
            [
              h.X(n(mark.x)),
              h.Y(n(mark.y)),
              h.Width(n(mark.size)),
              h.Height(n(mark.size)),
              h.Fill(mark.color),
            ],
            [],
          );
        case 'band':
          return h.rect(
            [
              h.Class('plot-legend-band'),
              h.X(n(mark.x)),
              h.Y(n(mark.y)),
              // A hair wider, so neighbouring bands leave no seam.
              h.Width(n(mark.width + 0.5)),
              h.Height(n(mark.height)),
              h.Fill(mark.color),
            ],
            [],
          );
        case 'symbol':
          return h.path(
            [
              h.D(mark.path),
              h.Transform(`translate(${n(mark.x)},${n(mark.y)})`),
              h.Fill(mark.color ?? 'currentColor'),
            ],
            [],
          );
        case 'label':
          return h.text(
            [
              h.X(n(mark.x)),
              h.Y(n(mark.y + palette.labelSize / 3)),
              h.Fill(palette.text),
              ...(mark.title ? [h.FontWeight('600')] : []),
            ],
            [mark.text],
          );
      }
    }),
  );
}

/**
 * The chart as a standalone SVG document: marks, axes, title and description,
 * then its legends drawn below the plot (the document grows to fit them),
 * over the theme's background. `legend: false` and `background: false` leave
 * them out.
 */
export function plotSvg(geometry: PlotGeometry, options: PlotSvgOptions = {}): string {
  const { theme = 'light', background, ...rest } = options;
  const palette = paletteOf(theme);
  const h = markupBuilder;
  const legends =
    rest.legend === false ? undefined : standaloneLegends(geometry, palette.labelSize);
  const height = n(geometry.height + (legends?.height ?? 0));
  const paint = background === false ? undefined : palette.background;
  return plotGraphic(
    h,
    geometry,
    { ...rest, palette },
    {
      attributes: [
        h.Attribute('xmlns', SVG_NAMESPACE),
        h.ViewBox(`0 0 ${geometry.width} ${height}`),
        h.Width(String(geometry.width)),
        h.Height(height),
        h.Attribute('font-family', palette.fontFamily),
        // Marks drawn in currentColor take the palette's text colour outside a page.
        ...(palette.text === 'currentColor' ? [] : [h.Attribute('color', palette.text)]),
      ],
      under:
        paint === undefined
          ? []
          : [
              h.rect(
                [
                  h.Class('plot-background'),
                  h.X('0'),
                  h.Y('0'),
                  h.Width(String(geometry.width)),
                  h.Height(height),
                  h.Fill(paint),
                ],
                [],
              ),
            ],
      over:
        legends === undefined || legends.height === 0 ? [] : [legendGraphics(h, legends, palette)],
    },
  ).markup;
}

export type PlotHtmlOptions = PlotChartOptions &
  Readonly<{
    /**
     * A theme for a chart that should not follow its page: the figure then
     * paints the theme's background and text colour. Takes precedence over
     * `palette`.
     */
    theme?: PlotTheme;
  }>;

/**
 * The whole chart as an HTML fragment, the same markup effect-ui/plot's
 * `plotChart` renders: a figure holding the SVG, its data table and legends,
 * in the page's colour unless given a theme.
 */
export function plotHtml(geometry: PlotGeometry, options: PlotHtmlOptions = {}): string {
  const { theme, ...rest } = options;
  if (theme === undefined) return plotFigure(markupBuilder, geometry, rest).markup;
  return plotFigure(markupBuilder, geometry, { ...rest, palette: paletteOf(theme) }, true).markup;
}

export { currentColorPalette, paletteOf };
export type { PlotTheme };
export type { PlotChartOptions, PlotOverlay, PlotPalette };
