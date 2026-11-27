import type { Mount, View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import {
  currentColorPalette,
  descriptionOf,
  overlayMarks,
  plotExtras,
  plotFigure,
} from '../plot/render.js';
import type { PlotChartOptions } from '../plot/render.js';
import type { PlotGeometry } from '../plot/types.js';

function builder<M>(h: Html.H<M>) {
  type Attribute = (element: View.ContainerBuilder<M>) => View.ContainerBuilder<M>;
  const attribute =
    (name: string) =>
    (value: string): Attribute =>
    (node) =>
      node.attr(name, value);
  const element =
    (tag: string) =>
    (attributes: ReadonlyArray<Attribute>, children: ReadonlyArray<View.Content<M> | string>) =>
      attributes.reduce((node, apply) => apply(node), h.el(tag)).children(...children);
  return {
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
    Class: attribute('class'),
    Cx: attribute('cx'),
    Cy: attribute('cy'),
    D: attribute('d'),
    Fill: attribute('fill'),
    FillOpacity: attribute('fill-opacity'),
    FontSize: attribute('font-size'),
    FontWeight: attribute('font-weight'),
    Height: attribute('height'),
    Key:
      (value: string): Attribute =>
      (node) =>
        node.key(value),
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
    AriaHidden: (value: boolean) => attribute('aria-hidden')(String(value)),
    Attribute: (name: string, value: string) => attribute(name)(value),
    Style: (value: Readonly<Record<string, string>>) =>
      attribute('style')(
        Object.entries(value)
          .map(([property, setting]) => property + ':' + setting)
          .join(';'),
      ),
  };
}

/** Renders shared Viz geometry as an Effect UI SVG figure with optional data tables. */
export function plotChart<M>(
  h: Html.H<M>,
  geometry: PlotGeometry,
  options: PlotChartOptions = {},
): View.Content<M> {
  return plotFigure(builder(h), geometry, options);
}

type CanvasNode =
  Html.Tags<never>['canvas'] extends Html.Element<never, never, infer _Events, infer Node, 'canvas'>
    ? Node
    : never;

type CanvasLayer<M> = Readonly<{
  key: string;
  onMount: Mount.Issued<M, never, CanvasNode, never>;
}>;

export type PlotCanvasOptions<M> = PlotChartOptions &
  CanvasLayer<M> &
  Readonly<{ pointsLayer?: CanvasLayer<M> }>;

/** Keeps the painted canvas and optional GPU layer intact while SVG overlays change. */
export function plotCanvas<M>(h: Html.H<M>, geometry: PlotGeometry, options: PlotCanvasOptions<M>) {
  const draw = builder(h);
  const palette = options.palette ?? currentColorPalette;
  const overlay =
    options.overlay === undefined ? [] : overlayMarks(draw, geometry, options.overlay);
  const label = [geometry.title, descriptionOf(geometry, options)].filter(Boolean).join('. ');
  const { pointsLayer } = options;
  return h.figure
    .class('plot plot-canvas')
    .style({ margin: '0', fontFamily: palette.fontFamily })
    .children(
      h.div
        .style({ position: 'relative', width: '100%', maxWidth: `${geometry.width}px` })
        .children(
          h.canvas
            .key(options.key)
            .attrs({ role: 'img', 'aria-label': label || undefined })
            .style({
              display: 'block',
              width: '100%',
              height: 'auto',
              aspectRatio: `${geometry.width} / ${geometry.height}`,
            })
            .onMount(options.onMount)
            .children(),
          pointsLayer !== undefined &&
            h.canvas
              .key(pointsLayer.key)
              .class('plot-points')
              .attr('aria-hidden', 'true')
              .style({
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              })
              .onMount(pointsLayer.onMount)
              .children(),
          h
            .el('svg')
            .attrs({
              class: 'plot-canvas-overlay',
              viewBox: `0 0 ${geometry.width} ${geometry.height}`,
              'aria-hidden': 'true',
              style:
                'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible',
            })
            .children(...overlay),
        ),
      ...plotExtras(draw, geometry, { ...options, palette }),
    );
}
