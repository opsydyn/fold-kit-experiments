import { arc } from '@opsydyn/foldkit-viz/shape/arc';
import { pie } from '@opsydyn/foldkit-viz/shape/pie';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { svgRoot } from '../shared';

// MODEL

export type Segment = Readonly<{ label: string; value: number; color: string }>;

export type Config = Readonly<{
  innerRadius: number;
  outerRadius: number;
  padAngle: number;
  cornerRadius: number;
  hoverGrow: number;
}>;

export type Model = Readonly<{
  segments: ReadonlyArray<Segment>;
  activeIndex: Option.Option<number>;
  config: Config;
}>;

export type InitConfig = Readonly<{
  segments: ReadonlyArray<Segment>;
  config?: Partial<Config>;
}>;

const DEFAULT_CONFIG: Config = {
  innerRadius: 60,
  outerRadius: 100,
  padAngle: 0.03,
  cornerRadius: 0,
  hoverGrow: 8,
};

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [
    {
      segments: cfg.segments,
      activeIndex: Option.none(),
      config: { ...DEFAULT_CONFIG, ...cfg.config },
    },
    [],
  ];
}

// MESSAGE

export const HoveredSegment = m('HoveredSegment', { index: Schema.Number });
export const BlurredSegment = m('BlurredSegment', {});
export const ClickedSegment = m('ClickedSegment', { index: Schema.Number });
export const PressedKeyNav = m('PressedKeyNav', { direction: Schema.String });

export const Message = Schema.Union([
  HoveredSegment,
  BlurredSegment,
  ClickedSegment,
  PressedKeyNav,
]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredSegment: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      BlurredSegment: () => [{ ...model, activeIndex: Option.none() }, []],
      ClickedSegment: ({ index }) => [{ ...model, activeIndex: Option.some(index) }, []],
      PressedKeyNav: ({ direction }) => {
        const n = model.segments.length;
        const current = Option.isSome(model.activeIndex) ? model.activeIndex.value : -1;
        const next = direction === 'next' ? (current + 1) % n : (current - 1 + n) % n;
        return [{ ...model, activeIndex: Option.some(next) }, []];
      },
    }),
  );

// VIEW

const SIZE = 240;
const CENTER = SIZE / 2;

export const view = <M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html => {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Donut chart' } = config;
  const { segments, activeIndex, config: cfg } = model;

  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const pieArcs = pie(segments, { value: (s) => s.value, padAngle: cfg.padAngle });

  const active = Option.isSome(activeIndex) ? segments[activeIndex.value] : undefined;
  const centerValue = active != null ? String(active.value) : String(total);
  const centerLabel = active != null ? active.label : 'total';

  const handleKeyDown = (key: string): Option.Option<M> => {
    if (key === 'ArrowRight' || key === 'ArrowDown')
      return Option.some(toParentMessage(PressedKeyNav({ direction: 'next' })));
    if (key === 'ArrowLeft' || key === 'ArrowUp')
      return Option.some(toParentMessage(PressedKeyNav({ direction: 'prev' })));
    return Option.none();
  };

  return svgRoot(h, { width: SIZE, height: SIZE, ariaLabel, interactive: true }, handleKeyDown, [
    h.g(
      [h.Transform(`translate(${CENTER},${CENTER})`)],
      [
        ...pieArcs.map((d, i) => {
          const isActive = Option.isSome(activeIndex) && activeIndex.value === i;
          const outerR = isActive ? cfg.outerRadius + cfg.hoverGrow : cfg.outerRadius;
          const pathD = arc({
            innerRadius: cfg.innerRadius,
            outerRadius: outerR,
            startAngle: d.startAngle,
            endAngle: d.endAngle,
            padAngle: d.padAngle,
            cornerRadius: cfg.cornerRadius,
          });
          return h.path(
            [
              h.D(pathD),
              h.Fill(d.data.color),
              h.Style({ cursor: 'pointer' }),
              h.AriaLabel(`${d.data.label}: ${d.data.value}`),
              h.OnMouseEnter(toParentMessage(HoveredSegment({ index: i }))),
              h.OnMouseLeave(toParentMessage(BlurredSegment({}))),
              h.OnClick(toParentMessage(ClickedSegment({ index: i }))),
              ...(isActive ? [h.DataAttribute('active', '')] : []),
            ],
            [],
          );
        }),
        h.g(
          [h.Style({ 'pointer-events': 'none' })],
          [
            h.text(
              [
                h.Transform('translate(0,-8)'),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'auto',
                  'font-size': '1.5rem',
                  'font-weight': '700',
                  fill: '#111',
                  'font-family': 'inherit',
                }),
              ],
              [centerValue],
            ),
            h.text(
              [
                h.Transform('translate(0,12)'),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'hanging',
                  'font-size': '0.7rem',
                  fill: '#888',
                  'letter-spacing': '0.06em',
                  'text-transform': 'uppercase',
                  'font-family': 'inherit',
                }),
              ],
              [centerLabel],
            ),
          ],
        ),
      ],
    ),
  ]);
};
