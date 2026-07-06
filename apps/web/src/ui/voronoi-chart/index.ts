import { triangulate, voronoiCells } from '@opsydyn/foldkit-viz/math/delaunay';
import { randomLcg } from '@opsydyn/foldkit-viz/math/random';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { svgRoot } from '../shared';

// MODEL

const W = 400;
const H = 290;
const MT = 12;
const MR = 12;
const MB = 12;
const ML = 12;
const PW = W - ML - MR;
const PH = H - MT - MB;

const NUM_POINTS = 55;

// Evenly distributed hues for cell colors
function cellColor(idx: number, n: number, active: boolean, inactive: boolean): string {
  const hue = Math.round((idx * 360) / n);
  const s = active ? '75%' : '60%';
  const l = active ? '65%' : '72%';
  const opacity = inactive ? 0.2 : 1;
  return `hsla(${hue},${s},${l},${opacity})`;
}

export type PlotData = Readonly<{
  points: ReadonlyArray<readonly [number, number]>;
  cellPaths: ReadonlyArray<string | null>;
}>;

export type Model = Readonly<{
  data: PlotData;
  n: number;
  hovered: Option.Option<number>;
}>;

function generate(seed: number): PlotData {
  const rng = randomLcg(seed);
  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i < NUM_POINTS; i++) {
    pts.push([ML + rng() * PW, MT + rng() * PH]);
  }
  const result = triangulate(pts);
  const cells = voronoiCells(result, [ML, MT, ML + PW, MT + PH]);
  const cellPaths = cells.map((cell) => {
    // biome-ignore lint: null used as skip sentinel in array — downstream filters it out
    if (!cell || cell.length < 2) return null;
    let d = `M${cell[0][0].toFixed(1)},${cell[0][1].toFixed(1)}`;
    for (let i = 1; i < cell.length; i++) {
      d += `L${cell[i][0].toFixed(1)},${cell[i][1].toFixed(1)}`;
    }
    return `${d}Z`;
  });
  return { points: pts, cellPaths };
}

export function init(seed = 7): readonly [Model, readonly []] {
  const data = generate(seed);
  return [{ data, n: NUM_POINTS, hovered: Option.none() }, []];
}

// MESSAGE

export const HoveredCell = m('HoveredCell', { idx: Schema.Number });
export const BlurredCell = m('BlurredCell', {});

export const Message = Schema.Union([HoveredCell, BlurredCell]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredCell: ({ idx }) => [{ ...model, hovered: Option.some(idx) }, []],
      BlurredCell: () => [{ ...model, hovered: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Voronoi diagram' } = config;
  const { data, n, hovered } = model;

  const active = Option.isSome(hovered) ? hovered.value : null;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    // Clip region
    h.defs(
      [],
      [
        h.clipPath(
          [h.Attribute('id', 'vor-clip')],
          [
            h.rect(
              [h.X(String(ML)), h.Y(String(MT)), h.Width(String(PW)), h.Height(String(PH))],
              [],
            ),
          ],
        ),
      ],
    ),

    // Filled cells
    h.g(
      [h.Attribute('clip-path', 'url(#vor-clip)')],
      data.cellPaths.map((d, idx) => {
        if (!d) return h.g([], []);
        const isActive = idx === active;
        const isInactive = active !== null && !isActive;
        return h.path(
          [
            h.D(d),
            h.Fill(cellColor(idx, n, isActive, isInactive)),
            h.Stroke('var(--card-bg, #12121f)'),
            h.StrokeWidth(isActive ? '1.5' : '0.8'),
            h.Style({ cursor: 'default', transition: 'fill 80ms' }),
            h.OnMouseEnter(toParentMessage(HoveredCell({ idx }))),
            h.OnMouseLeave(toParentMessage(BlurredCell())),
          ],
          [],
        );
      }),
    ),

    // Seed points
    h.g(
      [h.Attribute('clip-path', 'url(#vor-clip)')],
      data.points.map(([px, py], idx) => {
        const isActive = idx === active;
        const isInactive = active !== null && !isActive;
        return h.circle(
          [
            h.Cx(String(px.toFixed(1))),
            h.Cy(String(py.toFixed(1))),
            h.R(isActive ? '4' : '2.5'),
            h.Fill('#1e293b'),
            h.Opacity(isInactive ? '0.2' : '0.7'),
            h.Style({ 'pointer-events': 'none', transition: 'r 80ms' }),
          ],
          [],
        );
      }),
    ),
  ]);
}
