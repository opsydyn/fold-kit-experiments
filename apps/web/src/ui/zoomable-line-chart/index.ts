import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import {
  constrainScale,
  identityMatrix,
  rescaleDomain,
  scaleAt,
  type TransformMatrix,
  translateBy,
} from '@opsydyn/foldkit-viz/math/zoom';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { r3, svgRoot } from '../shared';

// MODEL

export type StockPoint = Readonly<{
  value: number;
  monthLabel: string | null;
}>;

export type InitConfig = Readonly<{
  points: ReadonlyArray<StockPoint>;
  color?: string;
}>;

export type Model = Readonly<{
  points: ReadonlyArray<StockPoint>;
  matrix: TransformMatrix;
  isDragging: boolean;
  dragStartX: number;
  color: string;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  return [
    {
      points: cfg.points,
      matrix: identityMatrix(),
      isDragging: false,
      dragStartX: 0,
      color: cfg.color ?? '#6366f1',
    },
    [],
  ];
}

// MESSAGE

export const ClickedZoomIn = m('ClickedZoomIn', {});
export const ClickedZoomOut = m('ClickedZoomOut', {});
export const ClickedReset = m('ClickedReset', {});
export const StartedDrag = m('StartedDrag', { clientX: Schema.Number });
export const MovedDrag = m('MovedDrag', { clientX: Schema.Number });
export const EndedDrag = m('EndedDrag', {});

export const Message = Schema.Union([
  ClickedZoomIn,
  ClickedZoomOut,
  ClickedReset,
  StartedDrag,
  MovedDrag,
  EndedDrag,
]);
export type Message = typeof Message.Type;

// UPDATE

const W = 480;
const PW = 404;
const MIN_SCALE = 1;
const MAX_SCALE = 12;
const ZOOM_FACTOR = 1.5;
const ZOOM_CENTER = { x: PW / 2, y: 0 };
const DRAG_SCALE = PW / W;

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      ClickedZoomIn: () => {
        const zoomed = scaleAt(model.matrix, ZOOM_FACTOR, 1, ZOOM_CENTER);
        const constrained = constrainScale(zoomed, model.matrix, MIN_SCALE, MAX_SCALE);
        return [{ ...model, matrix: constrained }, []];
      },
      ClickedZoomOut: () => {
        const zoomed = scaleAt(model.matrix, 1 / ZOOM_FACTOR, 1, ZOOM_CENTER);
        const constrained = constrainScale(zoomed, model.matrix, MIN_SCALE, MAX_SCALE);
        return [{ ...model, matrix: constrained }, []];
      },
      ClickedReset: () => [{ ...model, matrix: identityMatrix() }, []],
      StartedDrag: ({ clientX }) => [{ ...model, isDragging: true, dragStartX: clientX }, []],
      MovedDrag: ({ clientX }) => {
        if (!model.isDragging) {
          return [model, []];
        }
        const delta = (clientX - model.dragStartX) * DRAG_SCALE;
        return [
          { ...model, matrix: translateBy(model.matrix, -delta, 0), dragStartX: clientX },
          [],
        ];
      },
      EndedDrag: () => [{ ...model, isDragging: false }, []],
    }),
  );

// VIEW

const H = 265;
const MT = 28;
const MR = 24;
const MB = 44;
const ML = 52;
const PH = H - MT - MB;

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Zoomable stock price chart' } = config;
  const { points, matrix, isDragging, color } = model;

  const N = points.length;
  const fullDomain: readonly [number, number] = [0, N - 1];
  const plotRange: readonly [number, number] = [0, PW];

  const visibleDomain = rescaleDomain(fullDomain, plotRange, matrix, 'x');
  const [vd0, vd1] = visibleDomain;

  const visibleStart = Math.max(0, Math.floor(vd0));
  const visibleEnd = Math.min(N - 1, Math.ceil(vd1));

  const visiblePoints = points.slice(visibleStart, visibleEnd + 1);
  const visibleValues = visiblePoints.map((p) => p.value);
  const rawMin = Math.min(...visibleValues);
  const rawMax = Math.max(...visibleValues);
  const yPad = (rawMax - rawMin) * 0.1 || 5;
  const yDomain: readonly [number, number] = [rawMin - yPad, rawMax + yPad];

  const xScale = linear({ domain: visibleDomain, range: plotRange });
  const yScale = linear({ domain: yDomain, range: [PH, 0] });
  const yTicks = linearTicks(yDomain, 5);

  const coords: ReadonlyArray<readonly [number, number]> = points.map((p, i) => [
    r3(xScale(i)),
    r3(yScale(p.value)),
  ]);

  const visibleCoords = coords.filter(([cx]) => cx >= -2 && cx <= PW + 2);

  let linePath: string | null = null;
  let areaPath: string | null = null;
  if (visibleCoords.length >= 2) {
    const [first, ...rest] = visibleCoords as [
      readonly [number, number],
      ...Array<readonly [number, number]>,
    ];
    const last = rest[rest.length - 1] ?? first;
    linePath = `M${first[0]},${first[1]} ${rest.map(([x, y]) => `L${x},${y}`).join(' ')}`;
    areaPath = `${linePath} L${last[0]},${PH} L${first[0]},${PH} Z`;
  }

  const monthTicks = points.flatMap((p, i) => {
    if (p.monthLabel === null) {
      return [];
    }
    const cx = r3(xScale(i));
    if (cx < -20 || cx > PW + 20) {
      return [];
    }
    return [{ x: cx, label: p.monthLabel }];
  });

  const handlePointerDown = (
    _pointerType: string,
    _button: number,
    screenX: number,
    _screenY: number,
    _ts: number,
    _clientX: number,
  ): Option.Option<M> => Option.some(toParentMessage(StartedDrag({ clientX: screenX })));

  const handlePointerMove = (
    _screenX: number,
    _screenY: number,
    _pointerType: string,
  ): Option.Option<M> =>
    isDragging ? Option.some(toParentMessage(MovedDrag({ clientX: _screenX }))) : Option.none();

  const handlePointerUp = (
    _screenX: number,
    _screenY: number,
    _pointerType: string,
    _ts: number,
  ): Option.Option<M> => Option.some(toParentMessage(EndedDrag()));

  const btnY = 6;
  const btnH = 16;
  const btnW = 22;
  const btnR = 3;
  const btnGap = 4;
  const btnBaseX = W - MR - 3 * btnW - 2 * btnGap;

  const zoomOutX = btnBaseX;
  const resetX = btnBaseX + btnW + btnGap;
  const zoomInX = btnBaseX + 2 * (btnW + btnGap);

  const btnStyle = {
    cursor: 'pointer',
    'user-select': 'none',
  };

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    // Zoom controls
    h.g(
      [],
      [
        // Zoom out (−)
        h.g(
          [h.OnClick(toParentMessage(ClickedZoomOut())), h.Style(btnStyle)],
          [
            h.rect(
              [
                h.X(String(zoomOutX)),
                h.Y(String(btnY)),
                h.Width(String(btnW)),
                h.Height(String(btnH)),
                h.Attribute('rx', String(btnR)),
                h.Fill('var(--card-bg, #12121f)'),
                h.Stroke('var(--card-border, #1e1e33)'),
                h.StrokeWidth('1'),
              ],
              [],
            ),
            h.text(
              [
                h.X(String(zoomOutX + btnW / 2)),
                h.Y(String(btnY + btnH / 2 + 1)),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'middle',
                  'font-size': '0.8rem',
                  fill: '#475569',
                  'pointer-events': 'none',
                }),
              ],
              ['−'],
            ),
          ],
        ),
        // Reset (⟲)
        h.g(
          [h.OnClick(toParentMessage(ClickedReset())), h.Style(btnStyle)],
          [
            h.rect(
              [
                h.X(String(resetX)),
                h.Y(String(btnY)),
                h.Width(String(btnW)),
                h.Height(String(btnH)),
                h.Attribute('rx', String(btnR)),
                h.Fill('var(--card-bg, #12121f)'),
                h.Stroke('var(--card-border, #1e1e33)'),
                h.StrokeWidth('1'),
              ],
              [],
            ),
            h.text(
              [
                h.X(String(resetX + btnW / 2)),
                h.Y(String(btnY + btnH / 2 + 1)),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'middle',
                  'font-size': '0.75rem',
                  fill: '#475569',
                  'pointer-events': 'none',
                }),
              ],
              ['↺'],
            ),
          ],
        ),
        // Zoom in (+)
        h.g(
          [h.OnClick(toParentMessage(ClickedZoomIn())), h.Style(btnStyle)],
          [
            h.rect(
              [
                h.X(String(zoomInX)),
                h.Y(String(btnY)),
                h.Width(String(btnW)),
                h.Height(String(btnH)),
                h.Attribute('rx', String(btnR)),
                h.Fill('var(--card-bg, #12121f)'),
                h.Stroke('var(--card-border, #1e1e33)'),
                h.StrokeWidth('1'),
              ],
              [],
            ),
            h.text(
              [
                h.X(String(zoomInX + btnW / 2)),
                h.Y(String(btnY + btnH / 2 + 1)),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'middle',
                  'font-size': '0.8rem',
                  fill: '#475569',
                  'pointer-events': 'none',
                }),
              ],
              ['+'],
            ),
          ],
        ),
      ],
    ),

    // Plot area
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Clip mask for line/area
        h.defs(
          [],
          [
            h.clipPath(
              [h.Attribute('id', 'zl-clip')],
              [h.rect([h.X('0'), h.Y('0'), h.Width(String(PW)), h.Height(String(PH))], [])],
            ),
          ],
        ),

        // Y gridlines + labels
        h.g(
          [],
          yTicks.map((tick) => {
            const y = r3(yScale(tick));
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
                      'font-size': '0.65rem',
                      fill: '#94a3b8',
                    }),
                  ],
                  [String(Math.round(tick))],
                ),
              ],
            );
          }),
        ),

        // Area fill (clipped)
        h.g(
          [h.Attribute('clip-path', 'url(#zl-clip)')],
          areaPath ? [h.path([h.D(areaPath), h.Fill(`${color}18`), h.Stroke('none')], [])] : [],
        ),

        // Line (clipped)
        h.g(
          [h.Attribute('clip-path', 'url(#zl-clip)')],
          linePath
            ? [
                h.path(
                  [
                    h.D(linePath),
                    h.Fill('none'),
                    h.Stroke(color),
                    h.StrokeWidth('1.5'),
                    h.Style({ 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
                  ],
                  [],
                ),
              ]
            : [],
        ),

        // X axis baseline
        h.line(
          [
            h.X1('0'),
            h.Y1(String(PH)),
            h.X2(String(PW)),
            h.Y2(String(PH)),
            h.Stroke('var(--chart-axis, #3a3a3a)'),
            h.StrokeWidth('1'),
          ],
          [],
        ),

        // X axis month labels
        h.g(
          [h.Transform(`translate(0,${PH})`)],
          monthTicks.map(({ x, label }) =>
            h.text(
              [
                h.X(String(x)),
                h.Y('12'),
                h.Style({
                  'text-anchor': 'middle',
                  'dominant-baseline': 'hanging',
                  'font-size': '0.62rem',
                  fill: '#94a3b8',
                }),
              ],
              [label],
            ),
          ),
        ),

        // Drag overlay (transparent, captures pointer events)
        h.rect(
          [
            h.X('0'),
            h.Y('0'),
            h.Width(String(PW)),
            h.Height(String(PH)),
            h.Fill('transparent'),
            h.Style({ cursor: isDragging ? 'grabbing' : 'grab' }),
            h.OnPointerDown(handlePointerDown),
            h.OnPointerMove(handlePointerMove),
            h.OnPointerUp(handlePointerUp),
          ],
          [],
        ),
      ],
    ),
  ]);
}
