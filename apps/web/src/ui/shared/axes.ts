import type { Html, html } from 'foldkit/html';
import { r3 } from './math';

type H<M> = ReturnType<typeof html<M>>;

export type AxisStyle = Readonly<{
  gridColor?: string;
  axisColor?: string;
  labelColor?: string;
  labelSize?: string;
  format?: (v: number) => string;
}>;

const DEFAULTS: Required<AxisStyle> = {
  gridColor: 'var(--chart-grid, #e5e5e5)',
  axisColor: 'var(--chart-axis, #d4d4d4)',
  labelColor: 'var(--chart-label, #888)',
  labelSize: '0.7rem',
  format: String,
};

/**
 * Horizontal gridlines + left-side tick labels for a linear y-axis.
 * Render inside the plot-area group (already translated by margins).
 */
export function yGridlines<M>(
  h: H<M>,
  ticks: ReadonlyArray<number>,
  yScale: (v: number) => number,
  pw: number,
  style: AxisStyle = {},
): Html {
  const s = { ...DEFAULTS, ...style };
  return h.g(
    [h.Attribute('aria-hidden', 'true')],
    ticks.map((tick) => {
      const y = r3(yScale(tick));
      return h.g(
        [h.Transform(`translate(0,${y})`)],
        [
          h.line(
            [
              h.X1('0'),
              h.Y1('0'),
              h.X2(String(pw)),
              h.Y2('0'),
              h.Stroke(s.gridColor),
              h.StrokeWidth('1'),
            ],
            [],
          ),
          h.text(
            [
              h.X('-8'),
              h.Y('0'),
              h.Style({
                'text-anchor': 'end',
                'dominant-baseline': 'middle',
                'font-size': s.labelSize,
                fill: s.labelColor,
              }),
            ],
            [s.format(tick)],
          ),
        ],
      );
    }),
  );
}

/**
 * Bottom axis line + category labels for a band/ordinal x-axis.
 */
export function xCategoryAxis<M>(
  h: H<M>,
  labels: ReadonlyArray<string>,
  xPosition: (label: string) => number,
  bandwidth: number,
  ph: number,
  pw: number,
  style: AxisStyle = {},
): Html {
  const s = { ...DEFAULTS, ...style };
  return h.g(
    [],
    [
      h.line(
        [
          h.X1('0'),
          h.Y1(String(ph)),
          h.X2(String(pw)),
          h.Y2(String(ph)),
          h.Stroke(s.axisColor),
          h.StrokeWidth('1'),
        ],
        [],
      ),
      h.g(
        [h.Transform(`translate(0,${ph})`)],
        labels.map((label) =>
          h.text(
            [
              h.X(String(r3(xPosition(label) + bandwidth / 2))),
              h.Y('16'),
              h.Style({
                'text-anchor': 'middle',
                'dominant-baseline': 'hanging',
                'font-size': '0.75rem',
                fill: '#555',
              }),
            ],
            [label],
          ),
        ),
      ),
    ],
  );
}

/**
 * Bottom axis line + numeric labels for a linear x-axis.
 */
export function xLinearAxis<M>(
  h: H<M>,
  labels: ReadonlyArray<string>,
  xScale: (i: number) => number,
  ph: number,
  pw: number,
  style: AxisStyle = {},
): Html {
  const s = { ...DEFAULTS, ...style };
  return h.g(
    [],
    [
      h.line(
        [
          h.X1('0'),
          h.Y1(String(ph)),
          h.X2(String(pw)),
          h.Y2(String(ph)),
          h.Stroke(s.axisColor),
          h.StrokeWidth('1'),
        ],
        [],
      ),
      h.g(
        [h.Transform(`translate(0,${ph})`)],
        labels.map((label, i) =>
          h.text(
            [
              h.X(String(r3(xScale(i)))),
              h.Y('14'),
              h.Style({
                'text-anchor': 'middle',
                'dominant-baseline': 'hanging',
                'font-size': s.labelSize,
                fill: s.labelColor,
              }),
            ],
            [label],
          ),
        ),
      ),
    ],
  );
}

/**
 * Left-side tick labels + gridlines for a linear y-axis (same as yGridlines
 * but also draws vertical gridlines for scatter/dual-axis charts).
 */
export function xLinearGridlines<M>(
  h: H<M>,
  ticks: ReadonlyArray<number>,
  xScale: (v: number) => number,
  ph: number,
  style: AxisStyle = {},
): Html {
  const s = { ...DEFAULTS, ...style };
  return h.g(
    [h.Attribute('aria-hidden', 'true')],
    ticks.map((tick) => {
      const x = r3(xScale(tick));
      return h.g(
        [h.Transform(`translate(${x},0)`)],
        [
          h.line(
            [
              h.X1('0'),
              h.Y1('0'),
              h.X2('0'),
              h.Y2(String(ph)),
              h.Stroke(s.gridColor),
              h.StrokeWidth('1'),
            ],
            [],
          ),
          h.text(
            [
              h.X('0'),
              h.Y(String(ph + 14)),
              h.Style({
                'text-anchor': 'middle',
                'dominant-baseline': 'hanging',
                'font-size': s.labelSize,
                fill: s.labelColor,
              }),
            ],
            [s.format(tick)],
          ),
        ],
      );
    }),
  );
}
