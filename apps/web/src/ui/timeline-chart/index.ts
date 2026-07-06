import { band } from '@opsydyn/foldkit-viz/math/scale';
import { scaleTime, timeNice, timeTickFormat, timeTicks } from '@opsydyn/foldkit-viz/math/time';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot } from '../shared';

// MODEL

export type TimelineTask = Readonly<{
  name: string;
  start: Date;
  end: Date;
  color?: string;
}>;

export type InitConfig = Readonly<{
  tasks: ReadonlyArray<TimelineTask>;
  colors?: ReadonlyArray<string>;
  tickCount?: number;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type ComputedTask = Readonly<{
  name: string;
  start: Date;
  end: Date;
  color: string;
}>;

export type Model = Readonly<{
  tasks: ReadonlyArray<ComputedTask>;
  domain: readonly [Date, Date];
  activeTask: Option.Option<string>;
  tickCount: number;
  readonly layout: Layout;
}>;

const DEFAULT_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
];

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const colors = cfg.colors ?? DEFAULT_COLORS;
  const tickCount = cfg.tickCount ?? 6;

  const tasks: ComputedTask[] = cfg.tasks.map((t, i) => ({
    name: t.name,
    start: t.start,
    end: t.end,
    color: t.color ?? (colors[i % colors.length] as string),
  }));

  const allDates = tasks.flatMap((t) => [t.start, t.end]);
  const rawMin = new Date(Math.min(...allDates.map((d) => +d)));
  const rawMax = new Date(Math.max(...allDates.map((d) => +d)));
  const domain = timeNice([rawMin, rawMax], tickCount);
  const layout = makeLayout(
    { width: 480, height: 265, ...cfg.dims },
    { top: 16, right: 16, bottom: 36, left: 88, ...cfg.margins },
  );

  return [{ tasks, domain, activeTask: Option.none(), tickCount, layout }, []];
}

// MESSAGE

export const HoveredTask = m('HoveredTask', { name: Schema.String });
export const BlurredTask = m('BlurredTask', {});

export const Message = Schema.Union([HoveredTask, BlurredTask]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredTask: ({ name }) => [{ ...model, activeTask: Option.some(name) }, []],
      BlurredTask: () => [{ ...model, activeTask: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Timeline chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const { tasks, domain, activeTask, tickCount } = model;

  const xScale = scaleTime({ domain, range: [0, PW] });
  const yScale = band({
    domain: tasks.map((t) => t.name),
    range: [0, PH],
    paddingInner: 0.25,
    paddingOuter: 0.3,
  });
  const ticks = timeTicks(domain, tickCount);
  const activeTaskName = Option.isSome(activeTask) ? activeTask.value : null;
  const barHeight = yScale.bandwidth;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // X gridlines + tick labels
        h.g(
          [],
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
                    h.Y2(String(PH)),
                    h.Stroke('var(--chart-grid, #2d2d2d)'),
                    h.StrokeWidth('1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X('0'),
                    h.Y(String(PH + 14)),
                    h.Style({
                      'text-anchor': 'middle',
                      'dominant-baseline': 'hanging',
                      'font-size': '0.62rem',
                      fill: '#94a3b8',
                    }),
                  ],
                  [timeTickFormat(tick)],
                ),
              ],
            );
          }),
        ),

        // Task bars
        h.g(
          [],
          tasks.map((task) => {
            const x0 = r3(xScale(task.start));
            const x1 = r3(xScale(task.end));
            const barW = Math.max(2, x1 - x0);
            const y = r3(yScale.position(task.name));
            const isActive = task.name === activeTaskName;
            const opacity = activeTaskName === null ? 0.85 : isActive ? 1 : 0.3;

            return h.g(
              [
                h.OnMouseEnter(toParentMessage(HoveredTask({ name: task.name }))),
                h.OnMouseLeave(toParentMessage(BlurredTask())),
                h.Style({ cursor: 'default' }),
              ],
              [
                h.rect(
                  [
                    h.X(String(x0)),
                    h.Y(String(y)),
                    h.Width(String(barW)),
                    h.Height(String(barHeight)),
                    h.Fill(task.color),
                    h.Opacity(String(opacity)),
                    h.Style({ transition: 'opacity 80ms' }),
                  ],
                  [],
                ),
                ...(isActive
                  ? [
                      h.text(
                        [
                          h.X(String(x0 + barW / 2)),
                          h.Y(String(y + barHeight / 2)),
                          h.Style({
                            'text-anchor': 'middle',
                            'dominant-baseline': 'middle',
                            'font-size': '0.6rem',
                            'font-weight': '600',
                            fill: 'var(--page-text, #e8e8ff)',
                            'pointer-events': 'none',
                          }),
                        ],
                        [task.name],
                      ),
                    ]
                  : []),
              ],
            );
          }),
        ),

        // Y axis — task name labels
        h.g(
          [],
          tasks.map((task) => {
            const y = r3(yScale.position(task.name) + yScale.bandwidth / 2);
            const isActive = task.name === activeTaskName;
            return h.text(
              [
                h.X('-8'),
                h.Y(String(y)),
                h.Style({
                  'text-anchor': 'end',
                  'dominant-baseline': 'middle',
                  'font-size': '0.62rem',
                  'font-weight': isActive ? '600' : '400',
                  fill: isActive ? '#1e293b' : '#64748b',
                  transition: 'font-weight 80ms, fill 80ms',
                }),
              ],
              [task.name],
            );
          }),
        ),
      ],
    ),
  ]);
}
