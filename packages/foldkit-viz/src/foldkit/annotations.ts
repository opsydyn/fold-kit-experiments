import type { Html, HtmlBuilder } from 'foldkit/html';

import type { CartesianLayout, ProjectedDatum } from '../chart/cartesian.js';
import { finiteCoordinate } from '../chart/layout.js';
import type { ChartTheme, SeriesStyle } from '../chart/theme.js';

export type AnnotationOptions = Readonly<{
  layout: CartesianLayout;
  axis: 'x' | 'y';
  value: number;
  label: string;
  style: SeriesStyle;
}>;
export function annotation<M>(h: HtmlBuilder<M>, options: AnnotationOptions): Html {
  const { plot } = options.layout;
  const horizontal = options.axis === 'y';
  const position = finiteCoordinate(
    horizontal ? options.layout.y(options.value) : options.layout.x(options.value),
  );
  const x = horizontal ? plot.left : position;
  const y = horizontal ? position : plot.top;
  return h.g(
    [h.Class('chart-annotation'), h.AriaLabel(options.label), h.Fill(options.style.stroke)],
    [
      h.line(
        [
          h.X1(String(x)),
          h.Y1(String(y)),
          h.X2(String(horizontal ? plot.right : position)),
          h.Y2(String(horizontal ? position : plot.bottom)),
          h.Stroke(options.style.stroke),
          h.StrokeWidth(String(options.style.strokeWidth)),
          h.StrokeDasharray(options.style.dashPattern),
          h.Opacity(String(options.style.opacity)),
        ],
        [],
      ),
      h.text([h.X(String(x + 4)), h.Y(String(y - 6)), h.FontSize('12')], [options.label]),
    ],
  );
}
export type TooltipContext<T> = Readonly<{ datum: T; x: number; y: number; style: SeriesStyle }>;
export type TooltipOptions<T, M> = Readonly<{
  point: ProjectedDatum<T>;
  style: SeriesStyle;
  theme: ChartTheme;
  render?: (context: TooltipContext<T>, h: HtmlBuilder<M>) => Html;
}>;
export function tooltip<T, M>(h: HtmlBuilder<M>, options: TooltipOptions<T, M>): Html {
  const context = {
    datum: options.point.datum,
    x: options.point.x,
    y: options.point.y,
    style: options.style,
  };
  if (options.render) return options.render(context, h);
  const width = Math.max(48, options.point.key.length * options.theme.labelSize * 0.65 + 28);
  const top = context.y - options.theme.labelSize - 28;
  return h.g(
    [h.Class('chart-tooltip'), h.Style({ 'pointer-events': 'none' })],
    [
      h.rect(
        [
          h.X(String(context.x - width / 2)),
          h.Y(String(top)),
          h.Width(String(width)),
          h.Height(String(options.theme.labelSize + 16)),
          h.Rx('4'),
          h.Fill(options.theme.tooltipBackground),
        ],
        [],
      ),
      h.circle(
        [
          h.Cx(String(context.x - width / 2 + 10)),
          h.Cy(String(top + (options.theme.labelSize + 16) / 2)),
          h.R('3'),
          h.Fill(options.style.fill),
          h.Opacity(String(options.style.opacity)),
        ],
        [],
      ),
      h.text(
        [
          h.X(String(context.x + 6)),
          h.Y(String(top + options.theme.labelSize + 3)),
          h.TextAnchor('middle'),
          h.Fill(options.theme.tooltipText),
          h.FontSize(String(options.theme.labelSize)),
        ],
        [options.point.key],
      ),
    ],
  );
}
