import type { Html } from '@effect/ui/html';
import { axis, chartFrame, grid } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { symbolPath } from '@opsydyn/foldkit-viz/shape/symbol';

import { chartTheme, type scatterGeometry, seriesStyles } from './chart';
import { Message } from './message';

const styleFor = (key: string) => seriesStyles.get(key) ?? chartTheme.series;
const inspectionKeys = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Escape',
]);

export function scatterChart(
  h: Html.H<Message>,
  geometry: ReturnType<typeof scatterGeometry>,
  active: string | null,
) {
  const { layout, xTicks, yTicks, points } = geometry.cartesian;
  const selected = points.find(({ key }) => key === active);
  const tooltip = selected && scatterTooltip(h, layout.plot, selected);

  return chartFrame(
    h,
    {
      layout,
      title: 'Illustrative scatter plot',
      description: `${points.length} points. Use arrow keys, Home or End to inspect; Escape clears inspection. Group A uses circles and Group B squares.`,
      theme: chartTheme,
      onKeyDown: (key) => (inspectionKeys.has(key) ? Message.PressedChartKey({ key }) : undefined),
    },
    [
      grid(h, { layout, xTicks, yTicks, theme: chartTheme }),
      axis(h, {
        layout,
        orientation: 'left',
        ticks: yTicks,
        label: 'Y value',
        format: String,
        theme: chartTheme,
      }),
      axis(h, {
        layout,
        orientation: 'bottom',
        ticks: xTicks,
        label: 'X value',
        format: String,
        theme: chartTheme,
      }),
      h
        .el('g')
        .attr('class', 'chart-point-series')
        .children(
          ...points.map(({ key, seriesKey, datum, x, y }) => {
            const style = styleFor(seriesKey);
            const radius = style.pointRadius + (key === active ? 2 : 0);
            const inspected = Message.SelectedPoint({ id: key });
            return h
              .el('path')
              .key(key)
              .attrs({
                'data-symbol': style.symbol,
                transform: `translate(${x},${y})`,
                d: symbolPath(style.symbol, Math.PI * radius ** 2),
                fill: style.fill,
                stroke: key === active ? 'currentColor' : style.stroke,
                'stroke-width': String(style.strokeWidth),
                opacity: String(style.opacity),
                'aria-label': `${datum.id}, Group ${datum.group.toUpperCase()}, X ${datum.x}, Y ${datum.y}`,
                style: 'cursor:pointer',
              })
              .on('mouseenter', inspected)
              .on('click', inspected)
              .children();
          }),
        ),
      tooltip,
    ],
  );
}

type Cartesian = ReturnType<typeof scatterGeometry>['cartesian'];

function scatterTooltip(
  h: Html.H<Message>,
  plot: Cartesian['layout']['plot'],
  point: Cartesian['points'][number],
) {
  const width = Math.min(180, plot.width);
  const x = Math.max(plot.left, Math.min(plot.right - width, point.x - width / 2));
  const y = Math.max(plot.top, point.y - 64);
  const label = (offset: number, text: string) =>
    h
      .el('text')
      .attrs({
        x: String(x + 10),
        y: String(y + offset),
        fill: chartTheme.tooltipText,
        'font-size': '12',
      })
      .children(text);
  return h
    .el('g')
    .attrs({ class: 'chart-tooltip', 'pointer-events': 'none' })
    .children(
      h
        .el('rect')
        .attrs({
          x: String(x),
          y: String(y),
          width: String(width),
          height: '54',
          rx: '5',
          fill: chartTheme.tooltipBackground,
          stroke: styleFor(point.seriesKey).stroke,
        })
        .children(),
      label(20, point.datum.id + ' · Group ' + point.datum.group.toUpperCase()),
      label(40, `X ${point.datum.x} · Y ${point.datum.y}`),
    );
}

export function scatterLegend(h: Html.H<Message>) {
  const entries = [
    ['a', 'Group A · circles'],
    ['b', 'Group B · squares'],
  ] as const;
  return h.ul
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
      ...entries.map(([key, label]) => {
        const style = styleFor(key);
        return h.li
          .key(key)
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
          );
      }),
    );
}
