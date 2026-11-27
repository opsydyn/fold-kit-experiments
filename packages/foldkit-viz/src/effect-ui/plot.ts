import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import { plotFigure } from '../plot/render.js';
import type { PlotChartOptions } from '../plot/render.js';
import type { PlotGeometry } from '../plot/types.js';

/** Renders shared Viz geometry as an Effect UI SVG figure with optional data tables. */
export function plotChart<M>(
  h: Html.H<M>,
  geometry: PlotGeometry,
  options: PlotChartOptions = {},
): View.Content<M> {
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
  return plotFigure<Attribute, View.Content<M>>(
    {
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
      Key: (value) => (node) => node.key(value),
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
      AriaHidden: (value) => attribute('aria-hidden')(String(value)),
      Attribute: (name, value) => attribute(name)(value),
      Style: (value) =>
        attribute('style')(
          Object.entries(value)
            .map(([property, setting]) => property + ':' + setting)
            .join(';'),
        ),
    },
    geometry,
    options,
  );
}
