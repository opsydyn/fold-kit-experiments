import { currentColorPalette, plotFigure, plotGraphic } from '../plot/render.js';
import type { PlotBuilder, PlotChartOptions, PlotOverlay, PlotPalette } from '../plot/render.js';
import type { PlotGeometry } from '../plot/types.js';

/**
 * Compiled plot geometry (ADR 0037) as markup strings, with no framework and
 * no DOM: for files, server responses, notebooks and image pipelines. The
 * markup comes from plot/render, the renderer foldkit/plot uses, so a page and
 * an export always draw the same chart.
 */

/**
 * Concrete colours for a standalone SVG. Image renderers and file viewers have
 * no page colour to inherit and most cannot resolve `color-mix`, so the default
 * page palette would draw black or missing grid lines there.
 */
export const svgPalette: PlotPalette = {
  text: '#1f2328',
  mutedText: '#59636e',
  grid: '#d1d9e0',
  axis: '#818b98',
  fontFamily: 'system-ui, Helvetica, Arial, sans-serif',
  labelSize: 11,
};

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

export type PlotSvgOptions = Omit<PlotChartOptions, 'legend' | 'table'>;

/**
 * The chart as a standalone SVG document at its compiled size: marks, axes,
 * title and description, in `svgPalette` unless given another. Legends and the
 * data table are HTML beside the SVG, so they are in `plotHtml` only.
 */
export function plotSvg(geometry: PlotGeometry, options: PlotSvgOptions = {}): string {
  return plotGraphic(markupBuilder, geometry, { palette: svgPalette, ...options }, 'fixed').markup;
}

/**
 * The whole chart as an HTML fragment, the same markup foldkit/plot's
 * `plotChart` renders: a figure holding the SVG, its data table and legends,
 * in the page's colour by default.
 */
export function plotHtml(geometry: PlotGeometry, options: PlotChartOptions = {}): string {
  return plotFigure(markupBuilder, geometry, options).markup;
}

export { currentColorPalette };
export type { PlotChartOptions, PlotOverlay, PlotPalette };
