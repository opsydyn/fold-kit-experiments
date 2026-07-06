import { colorScale, interpolateRgbBasis } from '@opsydyn/foldkit-viz/math/color';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { svgRoot } from '../shared';

// MODEL

export type DayEntry = Readonly<{
  date: string; // YYYY-MM-DD (used as key)
  displayDate: string; // "Jan 15"
  count: number;
  color: string; // pre-computed
  weekIndex: number; // column (0 = first week)
  dayIndex: number; // row (0 = Sun … 6 = Sat)
}>;

export type MonthLabel = Readonly<{
  label: string;
  weekIndex: number;
}>;

export type LegendStop = Readonly<{ color: string }>;

export type InitConfig = Readonly<{
  days: ReadonlyArray<Omit<DayEntry, 'color'>>;
  monthLabels: ReadonlyArray<MonthLabel>;
  year: number;
  maxCount?: number;
  colors?: ReadonlyArray<string>;
}>;

export type Model = Readonly<{
  days: ReadonlyArray<DayEntry>;
  monthLabels: ReadonlyArray<MonthLabel>;
  year: number;
  maxCount: number;
  legendStops: ReadonlyArray<LegendStop>;
  activeDate: Option.Option<string>;
}>;

const GITHUB_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
const LEGEND_STEPS = 5;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const colors = cfg.colors ?? GITHUB_COLORS;
  const allCounts = cfg.days.map((d) => d.count);
  const maxCount = cfg.maxCount ?? Math.max(...allCounts, 1);
  const interpolator = interpolateRgbBasis(colors);
  const getColor = colorScale({ domain: [0, maxCount], interpolator, clamp: true });

  const days: ReadonlyArray<DayEntry> = cfg.days.map((d) => ({
    ...d,
    color: d.count === 0 ? (colors[0] ?? '#ebedf0') : getColor(d.count),
  }));

  const legendStops: ReadonlyArray<LegendStop> = Array.from({ length: LEGEND_STEPS }, (_, i) => ({
    color: i === 0 ? (colors[0] ?? '#ebedf0') : getColor((i / (LEGEND_STEPS - 1)) * maxCount),
  }));

  return [
    {
      days,
      monthLabels: cfg.monthLabels,
      year: cfg.year,
      maxCount,
      legendStops,
      activeDate: Option.none(),
    },
    [],
  ];
}

// MESSAGE

export const HoveredDay = m('HoveredDay', { date: Schema.String });
export const BlurredDay = m('BlurredDay', {});
export const Message = Schema.Union([HoveredDay, BlurredDay]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredDay: ({ date }) => [{ ...model, activeDate: Option.some(date) }, []],
      BlurredDay: () => [{ ...model, activeDate: Option.none() }, []],
    }),
  );

// VIEW

const W = 480;
const H = 265;
const ML = 28; // left margin (day labels)
const CELL_SLOT = 8; // px per cell (including gap)
const CELL_SIZE = 6; // actual cell size
const GRID_TOP = 76; // y of first cell row
const MONTH_Y = 63; // y of month labels

// Show Mon / Wed / Fri only (cells are 8px — all 7 would overlap)
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Commit activity calendar' } = config;
  const { days, monthLabels, legendStops, activeDate } = model;

  const isAnyActive = Option.isSome(activeDate);
  const activeDateVal = isAnyActive ? activeDate.value : null;
  const activeDay = activeDateVal ? days.find((d) => d.date === activeDateVal) : null;

  const legendY = GRID_TOP + 7 * CELL_SLOT + 20;
  const LEGEND_BOX = 8;
  const LEGEND_GAP = 3;
  const LEGEND_LABEL_W = 26;
  const legendTotalW = LEGEND_LABEL_W * 2 + LEGEND_STEPS * (LEGEND_BOX + LEGEND_GAP) - LEGEND_GAP;
  const legendX = ML + (53 * CELL_SLOT - legendTotalW) / 2;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    // Month labels
    h.g(
      [],
      monthLabels.map((ml) =>
        h.text(
          [
            h.X(String(ML + ml.weekIndex * CELL_SLOT)),
            h.Y(String(MONTH_Y)),
            h.Style({ 'font-size': '0.6rem', fill: '#64748b', 'font-weight': '500' }),
          ],
          [ml.label],
        ),
      ),
    ),

    // Day-of-week labels (Mon, Wed, Fri)
    h.g(
      [],
      DAY_LABELS.flatMap((label, i) =>
        label
          ? [
              h.text(
                [
                  h.X(String(ML - 4)),
                  h.Y(String(GRID_TOP + i * CELL_SLOT + CELL_SIZE / 2 + 1)),
                  h.Style({
                    'text-anchor': 'end',
                    'dominant-baseline': 'middle',
                    'font-size': '0.55rem',
                    fill: '#94a3b8',
                  }),
                ],
                [label],
              ),
            ]
          : [],
      ),
    ),

    // Cells
    h.g(
      [],
      days.map((day) =>
        h.rect(
          [
            h.X(String(ML + day.weekIndex * CELL_SLOT)),
            h.Y(String(GRID_TOP + day.dayIndex * CELL_SLOT)),
            h.Width(String(CELL_SIZE)),
            h.Height(String(CELL_SIZE)),
            h.Attribute('rx', '1'),
            h.Fill(day.color),
            h.Opacity(!isAnyActive ? '1' : day.date === activeDateVal ? '1' : '0.45'),
            h.Style({ transition: 'opacity 80ms', cursor: 'pointer' }),
            h.OnMouseEnter(toParentMessage(HoveredDay({ date: day.date }))),
            h.OnMouseLeave(toParentMessage(BlurredDay())),
          ],
          [],
        ),
      ),
    ),

    // Legend: Less □□□□□ More
    h.g(
      [h.Transform(`translate(${legendX}, ${legendY})`)],
      [
        h.text(
          [
            h.X('0'),
            h.Y(String(LEGEND_BOX / 2 + 1)),
            h.Style({ 'dominant-baseline': 'middle', 'font-size': '0.6rem', fill: '#94a3b8' }),
          ],
          ['Less'],
        ),
        ...legendStops.map((stop, i) =>
          h.rect(
            [
              h.X(String(LEGEND_LABEL_W + i * (LEGEND_BOX + LEGEND_GAP))),
              h.Y('0'),
              h.Width(String(LEGEND_BOX)),
              h.Height(String(LEGEND_BOX)),
              h.Attribute('rx', '1'),
              h.Fill(stop.color),
            ],
            [],
          ),
        ),
        h.text(
          [
            h.X(String(LEGEND_LABEL_W + LEGEND_STEPS * (LEGEND_BOX + LEGEND_GAP) + 4)),
            h.Y(String(LEGEND_BOX / 2 + 1)),
            h.Style({ 'dominant-baseline': 'middle', 'font-size': '0.6rem', fill: '#94a3b8' }),
          ],
          ['More'],
        ),
      ],
    ),

    // Hover tooltip
    h.text(
      [
        h.X(String(ML + (53 * CELL_SLOT) / 2)),
        h.Y(String(legendY + LEGEND_BOX + 16)),
        h.Style({
          'text-anchor': 'middle',
          'font-size': '0.65rem',
          'font-weight': '600',
          fill: activeDay ? '#475569' : 'transparent',
        }),
      ],
      [
        activeDay
          ? `${activeDay.count} commit${activeDay.count !== 1 ? 's' : ''} — ${activeDay.displayDate}`
          : ' ',
      ],
    ),
  ]);
}
