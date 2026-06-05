import { contourLines, density2d, segmentsToPath } from '@opsydyn/foldkit-viz/math/contour';
import { randomLcg, randomNormal } from '@opsydyn/foldkit-viz/math/random';
import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, svgRoot } from '../shared';

// MODEL

export type InitConfig = Readonly<{
  seed?: number;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

type ContourLevel = Readonly<{
  thresh: number;
  color: string;
  label: string;
}>;

const LEVELS: ReadonlyArray<ContourLevel> = [
  { thresh: 0.04, color: '#c7d2fe', label: 'low' },
  { thresh: 0.12, color: '#818cf8', label: 'mid' },
  { thresh: 0.24, color: '#3730a3', label: 'high' },
];

const NX = 40;
const NY = 35;
const X_DOMAIN: readonly [number, number] = [0, 4];
const Y_DOMAIN: readonly [number, number] = [0, 3.5];
const BANDWIDTH = 0.45;

export type PlotData = Readonly<{
  points: ReadonlyArray<readonly [number, number]>;
  grid: Float64Array;
}>;

export type Model = Readonly<{
  data: PlotData;
  hovered: Option.Option<string>;
  readonly layout: Layout;
}>;

function generateData(seed: number): PlotData {
  const rng = randomLcg(seed);
  const nx1 = randomNormal(1.2, 0.42, rng);
  const ny1 = randomNormal(2.8, 0.52, rng);
  const nx2 = randomNormal(1.6, 0.38, rng);
  const ny2 = randomNormal(2.1, 0.45, rng);

  const points: Array<readonly [number, number]> = [];
  for (let i = 0; i < 80; i++) points.push([nx1(), ny1()]);
  for (let i = 0; i < 100; i++) points.push([nx2(), ny2()]);

  const grid = density2d(points, {
    nx: NX,
    ny: NY,
    x: X_DOMAIN,
    y: Y_DOMAIN,
    bandwidth: BANDWIDTH,
  });

  return { points, grid };
}

export function init(cfg: InitConfig = {}): readonly [Model, readonly []] {
  const data = generateData(cfg.seed ?? 42);
  const layout = makeLayout(
    { width: 420, height: 280, ...cfg.dims },
    { top: 12, right: 16, bottom: 42, left: 20, ...cfg.margins },
  );
  return [{ data, hovered: Option.none(), layout }, []];
}

// MESSAGE

export const HoveredLevel = m('HoveredLevel', { label: Schema.String });
export const BlurredLevel = m('BlurredLevel', {});

export const Message = Schema.Union([HoveredLevel, BlurredLevel]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredLevel: ({ label }) => [{ ...model, hovered: Option.some(label) }, []],
      BlurredLevel: () => [{ ...model, hovered: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Density contour chart' } = config;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;
  const xSvg = linear({ domain: [0, NX - 1], range: [0, PW] });
  const ySvg = linear({ domain: [0, NY - 1], range: [PH, 0] }); // inverted Y
  const { data, hovered } = model;

  const active = Option.isSome(hovered) ? hovered.value : null;

  // Map data-space coords to SVG grid-cell coords (grid row j = y-axis)
  const xData = linear({ domain: X_DOMAIN, range: [0, NX - 1] });
  const yData = linear({ domain: Y_DOMAIN, range: [0, NY - 1] });

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Clip region definition
        h.defs(
          [],
          [
            h.clipPath(
              [h.Attribute('id', 'dc-clip')],
              [h.rect([h.X('0'), h.Y('0'), h.Width(String(PW)), h.Height(String(PH))], [])],
            ),
          ],
        ),

        // Plot area background
        h.rect(
          [
            h.X('0'),
            h.Y('0'),
            h.Width(String(PW)),
            h.Height(String(PH)),
            h.Fill('var(--card-bg, #12121f)'),
            h.Stroke('var(--card-border, #1e1e33)'),
            h.StrokeWidth('1'),
          ],
          [],
        ),

        // Scatter points
        h.g(
          [h.Attribute('clip-path', 'url(#dc-clip)')],
          data.points.map(([px, py]) =>
            h.circle(
              [
                h.Cx(String(xSvg(xData(px)).toFixed(1))),
                h.Cy(String(ySvg(yData(py)).toFixed(1))),
                h.R('2.5'),
                h.Fill('#64748b'),
                h.Opacity('0.22'),
              ],
              [],
            ),
          ),
        ),

        // Contour lines per level
        h.g(
          [h.Attribute('clip-path', 'url(#dc-clip)')],
          LEVELS.map(({ thresh, color, label }) => {
            const segs = contourLines(data.grid, NX, NY, thresh);
            const d = segmentsToPath(
              segs,
              (gx) => xSvg(gx),
              (gy) => ySvg(gy),
            );
            const isActive = label === active;
            const isInactive = active !== null && !isActive;
            return h.path(
              [
                h.D(d),
                h.Fill('none'),
                h.Stroke(color),
                h.StrokeWidth(isActive ? '2' : '1.5'),
                h.Opacity(isInactive ? '0.15' : '0.9'),
                h.Style({ transition: 'opacity 80ms' }),
              ],
              [],
            );
          }),
        ),

        // Legend
        h.g(
          [h.Transform(`translate(0,${PH + 18})`)],
          LEVELS.map(({ color, label }, i) => {
            const isActive = label === active;
            const isInactive = active !== null && !isActive;
            return h.g(
              [
                h.Transform(`translate(${i * 110},0)`),
                h.OnMouseEnter(toParentMessage(HoveredLevel({ label }))),
                h.OnMouseLeave(toParentMessage(BlurredLevel({}))),
                h.Style({ cursor: 'default' }),
              ],
              [
                h.line(
                  [
                    h.X1('0'),
                    h.Y1('-4'),
                    h.X2('16'),
                    h.Y2('-4'),
                    h.Stroke(color),
                    h.StrokeWidth('2.5'),
                    h.Opacity(isInactive ? '0.25' : '1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X('20'),
                    h.Y('0'),
                    h.Style({
                      'font-size': '0.6rem',
                      'font-weight': isActive ? '600' : '400',
                      fill: isInactive ? 'var(--chart-label-muted, #555)' : 'var(--chart-label, #888)',
                    }),
                  ],
                  [`density ${label}`],
                ),
              ],
            );
          }),
        ),
      ],
    ),
  ]);
}
