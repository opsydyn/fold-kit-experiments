import type { Html, HtmlBuilder } from 'foldkit/html';

import type { AxisTick, CartesianLayout } from '../chart/cartesian.js';
import type { ChartTheme } from '../chart/theme.js';

export type AxisOptions = Readonly<{
  layout: CartesianLayout;
  orientation: 'bottom' | 'left';
  ticks: ReadonlyArray<AxisTick>;
  label: string;
  format: (value: number) => string;
  theme: ChartTheme;
}>;
export type GridOptions = Readonly<{
  layout: CartesianLayout;
  xTicks: ReadonlyArray<AxisTick>;
  yTicks: ReadonlyArray<AxisTick>;
  theme: ChartTheme;
}>;
export function grid<M>(h: HtmlBuilder<M>, options: GridOptions): Html {
  const { plot } = options.layout;
  return h.g(
    [h.Class('chart-grid'), h.Stroke(options.theme.grid), h.StrokeWidth('1'), h.AriaHidden(true)],
    [
      ...options.xTicks.map((t) =>
        h.line(
          [
            h.X1(String(t.position)),
            h.Y1(String(plot.top)),
            h.X2(String(t.position)),
            h.Y2(String(plot.bottom)),
          ],
          [],
        ),
      ),
      ...options.yTicks.map((t) =>
        h.line(
          [
            h.X1(String(plot.left)),
            h.Y1(String(t.position)),
            h.X2(String(plot.right)),
            h.Y2(String(t.position)),
          ],
          [],
        ),
      ),
    ],
  );
}
export function axis<M>(h: HtmlBuilder<M>, options: AxisOptions): Html {
  const { plot, frame } = options.layout;
  const bottom = options.orientation === 'bottom';
  return h.g(
    [
      h.Class(`chart-axis chart-axis-${options.orientation}`),
      h.Fill(options.theme.mutedText),
      h.FontSize(String(options.theme.labelSize)),
    ],
    [
      h.line(
        [
          h.X1(String(plot.left)),
          h.Y1(String(bottom ? plot.bottom : plot.top)),
          h.X2(String(bottom ? plot.right : plot.left)),
          h.Y2(String(plot.bottom)),
          h.Stroke(options.theme.axis),
        ],
        [],
      ),
      ...options.ticks.map((t) =>
        h.text(
          [
            h.X(String(bottom ? t.position : plot.left - 8)),
            h.Y(String(bottom ? plot.bottom + options.theme.labelSize + 8 : t.position + 4)),
            h.TextAnchor(bottom ? 'middle' : 'end'),
          ],
          [options.format(t.value)],
        ),
      ),
      h.text(
        [
          h.X(String(bottom ? (plot.left + plot.right) / 2 : plot.left)),
          h.Y(String(bottom ? frame.height - 8 : Math.max(options.theme.labelSize, plot.top - 10))),
          h.TextAnchor(bottom ? 'middle' : 'start'),
          h.Fill(options.theme.text),
        ],
        [options.label],
      ),
    ],
  );
}
