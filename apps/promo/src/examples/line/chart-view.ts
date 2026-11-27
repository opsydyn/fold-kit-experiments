import type { Html } from '@effect/ui/html';
import type { SeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { axis, chartFrame, grid } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { symbolPath } from '@opsydyn/foldkit-viz/shape/symbol';

import { chartTheme, comparisonStyle, seriesStyle, type chartGeometry } from './chart';
import type { Message } from './message';

const line = (h: Html.H<Message>, path: string, style: SeriesStyle) =>
  h
    .el('path')
    .attrs({
      class: 'chart-line-series',
      d: path,
      fill: 'none',
      stroke: style.stroke,
      'stroke-width': String(style.strokeWidth),
      'stroke-dasharray': style.dashPattern,
      opacity: String(style.opacity),
    })
    .children();

export function lineChart(
  h: Html.H<Message>,
  geometry: ReturnType<typeof chartGeometry>,
  comparisonPath: string,
  values: ReadonlyArray<number>,
) {
  const { layout, xTicks, yTicks, points } = geometry.cartesian;
  const threshold = layout.y(80);
  const { left, right } = layout.plot;
  return chartFrame(
    h,
    {
      layout,
      title: 'Illustrative line chart',
      description: `Values: ${values.join(', ')}. Dashed reference is 75% of each value; threshold is 80 units.`,
      theme: chartTheme,
    },
    [
      grid(h, { layout, xTicks, yTicks, theme: chartTheme }),
      axis(h, {
        layout,
        orientation: 'left',
        ticks: yTicks,
        label: 'Value (units)',
        theme: chartTheme,
      }),
      axis(h, {
        layout,
        orientation: 'bottom',
        ticks: xTicks.filter(({ value }) => Number.isInteger(value)),
        label: 'Point',
        format: (value) => String(value + 1),
        theme: chartTheme,
      }),
      line(h, comparisonPath, comparisonStyle),
      line(h, geometry.path, seriesStyle),
      h
        .el('g')
        .attr('class', 'chart-point-series')
        .children(
          ...points.map(({ key, x, y, datum }) =>
            h
              .el('path')
              .key(key)
              .attrs({
                transform: `translate(${x} ${y})`,
                d: symbolPath(seriesStyle.symbol, seriesStyle.pointRadius ** 2 * Math.PI),
                'data-symbol': seriesStyle.symbol,
                fill: seriesStyle.fill,
                stroke: seriesStyle.stroke,
                'stroke-width': String(seriesStyle.strokeWidth),
                opacity: String(seriesStyle.opacity),
                'aria-label': String(datum),
              })
              .children(h.el('title').children(String(datum))),
          ),
        ),
      h
        .el('g')
        .attrs({
          class: 'chart-annotation',
          fill: comparisonStyle.stroke,
          'aria-label': 'Threshold 80',
        })
        .children(
          h
            .el('line')
            .attrs({
              x1: String(left),
              x2: String(right),
              y1: String(threshold),
              y2: String(threshold),
              stroke: comparisonStyle.stroke,
              'stroke-width': String(comparisonStyle.strokeWidth),
              'stroke-dasharray': comparisonStyle.dashPattern,
              opacity: String(comparisonStyle.opacity),
            })
            .children(),
          h
            .el('text')
            .attrs({
              x: String(left + 4),
              y: String(threshold - 6),
              'font-size': '12',
            })
            .children('Threshold 80'),
        ),
    ],
  );
}

const entries = [
  ['Values', seriesStyle],
  ['75% reference', comparisonStyle],
] as const;

export const lineLegend = (h: Html.H<Message>) =>
  h.ul
    .class('chart-legend')
    .style({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      padding: '0',
      margin: '12px 0',
      listStyle: 'none',
      color: chartTheme.text,
      fontFamily: chartTheme.fontFamily,
      fontSize: `${chartTheme.labelSize}px`,
    })
    .children(
      ...entries.map(([label, style]) =>
        h.li
          .key(label)
          .style({ display: 'flex', alignItems: 'center', gap: '6px' })
          .children(
            h
              .el('svg')
              .attrs({ width: '20', height: '20', viewBox: '-10 -10 20 20', 'aria-hidden': 'true' })
              .children(
                h
                  .el('path')
                  .attrs({
                    'data-symbol': style.symbol,
                    d: symbolPath(style.symbol, 64),
                    fill: style.fill,
                    stroke: style.stroke,
                    'stroke-width': String(style.strokeWidth),
                    opacity: String(style.opacity),
                  })
                  .children(),
              ),
            label,
          ),
      ),
    );
