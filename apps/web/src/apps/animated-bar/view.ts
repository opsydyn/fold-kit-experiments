import type { Html } from '@effect/ui/html';
import { band, linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { tweenValue } from '@opsydyn/foldkit-viz/math/tween';
import { Option } from 'effect';

import { Message } from './message';
import { eased, type Model } from './model';

const W = 480,
  H = 260,
  MT = 20,
  MR = 20,
  MB = 40,
  ML = 44;
const PW = W - ML - MR,
  PH = H - MT - MB;

const svgNumber = (value: number) => String(Math.round(value * 1000) / 1000);

export const view = (h: Html.H<Message>, model: Model) => {
  const { bars, tweens, activeIndex } = model;
  const maxValue = bars.reduce((max, bar) => Math.max(max, bar.value), 0);
  const xScale = band({
    domain: bars.map((bar) => bar.label),
    range: [0, PW],
    paddingInner: 0.25,
    paddingOuter: 0.1,
  });
  const yDomain = [0, maxValue * 1.1] as const;
  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const yTicks = linearTicks(yDomain, 5);
  const barWidth = xScale.bandwidth;
  const rule = (stroke: string) =>
    h.el('line').attrs({ x1: '0', y1: '0', x2: String(PW), y2: '0', stroke, 'stroke-width': '1' });

  const grid = yTicks.map((tick) =>
    h
      .el('g')
      .attr('transform', `translate(0,${svgNumber(yScale(tick))})`)
      .children(
        rule('var(--chart-grid, #2d2d2d)'),
        h
          .el('text')
          .attrs({
            x: '-8',
            y: '0',
            'text-anchor': 'end',
            'dominant-baseline': 'middle',
            'font-size': '0.7rem',
            fill: 'var(--chart-label, #888)',
          })
          .children(String(Math.round(tick))),
      ),
  );

  const marks = bars.map((bar, index) => {
    const tween = tweens[index];
    const value = tween === undefined ? bar.value : tweenValue(0, bar.value, eased(tween));
    const x = xScale.position(bar.label);
    const y = yScale(value);
    const active = Option.contains(activeIndex, index);
    return h
      .el('g')
      .key(bar.label)
      .attr('aria-label', `${bar.label}: ${bar.value}`)
      .attr('style', 'cursor:default')
      .on('mouseenter', Message.HoveredBar({ index }))
      .on('mouseleave', Message.BlurredBar())
      .children(
        h.el('rect').attrs({
          x: svgNumber(x),
          y: svgNumber(y),
          width: svgNumber(barWidth),
          height: svgNumber(Math.max(0, PH - y)),
          fill: bar.color,
          opacity: active ? '1' : '0.8',
        }),
        active
          ? h
              .el('text')
              .attrs({
                x: svgNumber(x + barWidth / 2),
                y: svgNumber(y - 6),
                'text-anchor': 'middle',
                'font-size': '0.75rem',
                'font-weight': '700',
                fill: bar.color,
              })
              .children(String(bar.value))
          : undefined,
      );
  });

  const labels = bars.map((bar) =>
    h
      .el('text')
      .attrs({
        x: svgNumber(xScale.position(bar.label) + barWidth / 2),
        y: '16',
        'text-anchor': 'middle',
        'font-size': '0.7rem',
        fill: 'var(--chart-label, #888)',
      })
      .children(bar.label),
  );

  return h
    .el('svg')
    .attrs({
      viewBox: `0 0 ${W} ${H}`,
      width: '100%',
      role: 'img',
      'aria-label': 'Animated bar chart',
    })
    .children(
      h.el('title').children('Animated bar chart'),
      h
        .el('g')
        .attr('transform', `translate(${ML},${MT})`)
        .children(
          h.el('g').attr('aria-hidden', 'true').children(grid),
          h.el('g').children(marks),
          h
            .el('g')
            .attrs({ transform: `translate(0,${PH})`, 'aria-hidden': 'true' })
            .children(rule('var(--chart-axis, #3a3a3a)'), labels),
        ),
    );
};
