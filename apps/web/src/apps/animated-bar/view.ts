import { band, linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { tweenValue } from '@opsydyn/foldkit-viz/math/tween';
import { Option } from 'effect';
import type { Document, Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import type { Message } from './message';
import { BlurredBar, HoveredBar } from './message';
import type { Model } from './model';

const W = 480,
  H = 260,
  MT = 20,
  MR = 20,
  MB = 40,
  ML = 44;
const PW = W - ML - MR,
  PH = H - MT - MB;

export const view = (model: Model): Document => {
  const h = html<Message>();
  const { bars, tweens, activeIndex } = model;

  const maxValue = bars.reduce((m, b) => Math.max(m, b.value), 0);
  const xScale = band({
    domain: bars.map((b) => b.label),
    range: [0, PW],
    paddingInner: 0.25,
    paddingOuter: 0.1,
  });
  const yScale = linear({ domain: [0, maxValue * 1.1], range: [PH, 0] });
  const yTicks = linearTicks([0, maxValue * 1.1], 5);

  const svgEl: Html = h.svg(
    [h.ViewBox(`0 0 ${W} ${H}`), h.Width('100%'), h.Role('img'), h.AriaLabel('Animated bar chart')],
    [
      h.title([], ['Animated bar chart']),
      h.g(
        [h.Transform(`translate(${ML},${MT})`)],
        [
          // Y gridlines
          h.g(
            [h.Attribute('aria-hidden', 'true')],
            yTicks.map((t) => {
              const y = Math.round(yScale(t) * 1000) / 1000;
              return h.g(
                [h.Transform(`translate(0,${y})`)],
                [
                  h.line(
                    [
                      h.X1('0'),
                      h.Y1('0'),
                      h.X2(String(PW)),
                      h.Y2('0'),
                      h.Stroke('var(--chart-grid, #2d2d2d)'),
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
                        'font-size': '0.7rem',
                        fill: 'var(--chart-label, #888)',
                      }),
                    ],
                    [String(Math.round(t))],
                  ),
                ],
              );
            }),
          ),

          // Bars — height driven by tween progress
          h.g(
            [],
            bars.map((bar, i) => {
              const tween = tweens[i];
              const progress = tween?.progress ?? 1;
              // Animate from 0 to full height using tweenValue
              const animatedValue = tweenValue(0, bar.value, { progress } as Parameters<
                typeof tweenValue
              >[2]);
              const bx = Math.round(xScale.position(bar.label) * 1000) / 1000;
              const bw = Math.round(xScale.bandwidth * 1000) / 1000;
              const barH = Math.max(0, Math.round((PH - yScale(animatedValue)) * 1000) / 1000);
              const by = Math.round(yScale(animatedValue) * 1000) / 1000;
              const isActive = Option.isSome(activeIndex) && activeIndex.value === i;

              return h.g(
                [
                  h.OnMouseEnter(HoveredBar({ index: i })),
                  h.OnMouseLeave(BlurredBar()),
                  h.Style({ cursor: 'default' }),
                  h.AriaLabel(`${bar.label}: ${bar.value}`),
                ],
                [
                  h.rect(
                    [
                      h.X(String(bx)),
                      h.Y(String(by)),
                      h.Width(String(bw)),
                      h.Height(String(barH)),
                      h.Fill(bar.color),
                      h.Opacity(isActive ? '1' : '0.8'),
                    ],
                    [],
                  ),
                  ...(isActive
                    ? [
                        h.text(
                          [
                            h.X(String(bx + bw / 2)),
                            h.Y(String(by - 6)),
                            h.Style({
                              'text-anchor': 'middle',
                              'font-size': '0.75rem',
                              'font-weight': '700',
                              fill: bar.color,
                            }),
                          ],
                          [String(bar.value)],
                        ),
                      ]
                    : []),
                ],
              );
            }),
          ),

          // X axis labels
          h.g(
            [h.Transform(`translate(0,${PH})`), h.Attribute('aria-hidden', 'true')],
            [
              h.line(
                [
                  h.X1('0'),
                  h.Y1('0'),
                  h.X2(String(PW)),
                  h.Y2('0'),
                  h.Stroke('var(--chart-axis, #3a3a3a)'),
                  h.StrokeWidth('1'),
                ],
                [],
              ),
              ...bars.map((bar) =>
                h.text(
                  [
                    h.X(
                      String(
                        Math.round((xScale.position(bar.label) + xScale.bandwidth / 2) * 1000) /
                          1000,
                      ),
                    ),
                    h.Y('16'),
                    h.Style({
                      'text-anchor': 'middle',
                      'font-size': '0.75rem',
                      fill: 'var(--chart-label, #888)',
                    }),
                  ],
                  [bar.label],
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );

  return { title: 'Animated bar chart — foldkit-viz', body: svgEl };
};
