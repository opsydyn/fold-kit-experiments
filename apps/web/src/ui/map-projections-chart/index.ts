import {
  geoEquirectangular,
  geoGraticule,
  geoMercator,
  geoPath,
} from '@opsydyn/foldkit-viz/shape/geo';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

// MODEL

const W = 500;
const H = 240;
const MT = 22;
const MB = 8;
const ML = 10;
const MR = 10;
const INNER_W = (W - ML - MR) / 2; // 240 per projection
const SCALE = INNER_W / (2 * Math.PI); // ~38.2 — fits ±180° in INNER_W

// Center of each half in SVG space
const CX_L = ML + INNER_W / 2; // 130
const CX_R = ML + INNER_W + INNER_W / 2; // 370
const CY = MT + (H - MT - MB) / 2; // vertical center

const equiProj = geoEquirectangular({ scale: SCALE, translate: [CX_L, CY] });
const mercProj = geoMercator({ scale: SCALE, translate: [CX_R, CY] });

const graticule = geoGraticule(30);
const graticuleEqui = geoPath(equiProj)(graticule);
const graticuleMerc = geoPath(mercProj)(graticule);

// Major world cities [lng, lat, name]
type City = readonly [number, number, string];
const CITIES: ReadonlyArray<City> = [
  [139.7, 35.7, 'Tokyo'],
  [77.2, 28.6, 'Delhi'],
  [121.5, 31.2, 'Shanghai'],
  [72.8, 19.1, 'Mumbai'],
  [-46.6, -23.5, 'São Paulo'],
  [-74.0, 40.7, 'New York'],
  [3.4, 6.5, 'Lagos'],
  [-99.1, 19.4, 'Mexico City'],
  [90.4, 23.7, 'Dhaka'],
  [29.0, 41.0, 'Istanbul'],
  [-0.1, 51.5, 'London'],
  [37.6, 55.8, 'Moscow'],
  [151.2, -33.9, 'Sydney'],
  [-58.4, -34.6, 'Buenos Aires'],
  [18.4, -33.9, 'Cape Town'],
  [55.3, 25.2, 'Dubai'],
  [103.8, 1.4, 'Singapore'],
  [2.3, 48.9, 'Paris'],
  [116.4, 39.9, 'Beijing'],
  [-43.2, -22.9, 'Rio'],
];

export type Model = Readonly<{
  hovered: Option.Option<string>;
}>;

export function init(): readonly [Model, readonly []] {
  return [{ hovered: Option.none() }, []];
}

// MESSAGE

export const HoveredCity = m('HoveredCity', { name: Schema.String });
export const BlurredCity = m('BlurredCity', {});

export const Message = Schema.Union([HoveredCity, BlurredCity]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredCity: ({ name }) => [{ ...model, hovered: Option.some(name) }, []],
      BlurredCity: () => [{ ...model, hovered: Option.none() }, []],
    }),
  );

// VIEW — bounding box for each map panel (for clipping)
const EQUI_X0 = ML;
const EQUI_X1 = ML + INNER_W;
const MERC_X0 = ML + INNER_W;
const MERC_X1 = ML + 2 * INNER_W;
const MAP_Y0 = MT;
const MAP_Y1 = H - MB;

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Map projections comparison' } = config;
  const { hovered } = model;

  const active = Option.isSome(hovered) ? hovered.value : null;

  return h.svg(
    [
      h.ViewBox(`0 0 ${W} ${H}`),
      h.Width('100%'),
      h.Role('img'),
      h.AriaLabel(ariaLabel),
      h.Style({ display: 'block', 'font-family': 'inherit' }),
    ],
    [
      // Clip paths for each panel
      h.defs(
        [],
        [
          h.clipPath(
            [h.Attribute('id', 'equi-clip')],
            [
              h.rect(
                [
                  h.X(String(EQUI_X0)),
                  h.Y(String(MAP_Y0)),
                  h.Width(String(INNER_W)),
                  h.Height(String(MAP_Y1 - MAP_Y0)),
                ],
                [],
              ),
            ],
          ),
          h.clipPath(
            [h.Attribute('id', 'merc-clip')],
            [
              h.rect(
                [
                  h.X(String(MERC_X0)),
                  h.Y(String(MAP_Y0)),
                  h.Width(String(INNER_W)),
                  h.Height(String(MAP_Y1 - MAP_Y0)),
                ],
                [],
              ),
            ],
          ),
        ],
      ),

      // Panel backgrounds
      h.rect(
        [
          h.X(String(EQUI_X0)),
          h.Y(String(MAP_Y0)),
          h.Width(String(INNER_W)),
          h.Height(String(MAP_Y1 - MAP_Y0)),
          h.Fill('#f0f4f8'),
        ],
        [],
      ),
      h.rect(
        [
          h.X(String(MERC_X0)),
          h.Y(String(MAP_Y0)),
          h.Width(String(INNER_W)),
          h.Height(String(MAP_Y1 - MAP_Y0)),
          h.Fill('#f0f4f8'),
        ],
        [],
      ),

      // Panel labels
      h.text(
        [
          h.X(String((EQUI_X0 + EQUI_X1) / 2)),
          h.Y(String(MAP_Y0 - 6)),
          h.Style({ 'text-anchor': 'middle', 'font-size': '0.62rem', 'font-weight': '600', fill: '#475569' }),
        ],
        ['Equirectangular'],
      ),
      h.text(
        [
          h.X(String((MERC_X0 + MERC_X1) / 2)),
          h.Y(String(MAP_Y0 - 6)),
          h.Style({ 'text-anchor': 'middle', 'font-size': '0.62rem', 'font-weight': '600', fill: '#475569' }),
        ],
        ['Mercator'],
      ),

      // Graticule — Equirectangular
      h.path(
        [
          h.D(graticuleEqui),
          h.Fill('none'),
          h.Stroke('#cbd5e1'),
          h.StrokeWidth('0.5'),
          h.Attribute('clip-path', 'url(#equi-clip)'),
        ],
        [],
      ),

      // Graticule — Mercator
      h.path(
        [
          h.D(graticuleMerc),
          h.Fill('none'),
          h.Stroke('#cbd5e1'),
          h.StrokeWidth('0.5'),
          h.Attribute('clip-path', 'url(#merc-clip)'),
        ],
        [],
      ),

      // Cities — Equirectangular
      h.g(
        [h.Attribute('clip-path', 'url(#equi-clip)')],
        CITIES.map(([lng, lat, name]) => {
          const [cx, cy] = equiProj(lng, lat);
          const isActive = name === active;
          const isInactive = active !== null && !isActive;
          return h.g(
            [
              h.OnMouseEnter(toParentMessage(HoveredCity({ name }))),
              h.OnMouseLeave(toParentMessage(BlurredCity({}))),
              h.Style({ cursor: 'default' }),
            ],
            [
              h.circle(
                [
                  h.Cx(String(cx.toFixed(1))),
                  h.Cy(String(cy.toFixed(1))),
                  h.R(isActive ? '4' : '2.5'),
                  h.Fill(isActive ? '#ef4444' : '#6366f1'),
                  h.Opacity(isInactive ? '0.2' : '0.9'),
                ],
                [],
              ),
              ...(isActive
                ? [
                    h.text(
                      [
                        h.X(String((cx + 5).toFixed(1))),
                        h.Y(String((cy - 4).toFixed(1))),
                        h.Style({
                          'font-size': '0.55rem',
                          'font-weight': '600',
                          fill: '#1e293b',
                          'pointer-events': 'none',
                        }),
                      ],
                      [name],
                    ),
                  ]
                : []),
            ],
          );
        }),
      ),

      // Cities — Mercator
      h.g(
        [h.Attribute('clip-path', 'url(#merc-clip)')],
        CITIES.map(([lng, lat, name]) => {
          const [cx, cy] = mercProj(lng, lat);
          const isActive = name === active;
          const isInactive = active !== null && !isActive;
          return h.g(
            [
              h.OnMouseEnter(toParentMessage(HoveredCity({ name }))),
              h.OnMouseLeave(toParentMessage(BlurredCity({}))),
              h.Style({ cursor: 'default' }),
            ],
            [
              h.circle(
                [
                  h.Cx(String(cx.toFixed(1))),
                  h.Cy(String(cy.toFixed(1))),
                  h.R(isActive ? '4' : '2.5'),
                  h.Fill(isActive ? '#ef4444' : '#6366f1'),
                  h.Opacity(isInactive ? '0.2' : '0.9'),
                ],
                [],
              ),
              ...(isActive
                ? [
                    h.text(
                      [
                        h.X(String((cx + 5).toFixed(1))),
                        h.Y(String((cy - 4).toFixed(1))),
                        h.Style({
                          'font-size': '0.55rem',
                          'font-weight': '600',
                          fill: '#1e293b',
                          'pointer-events': 'none',
                        }),
                      ],
                      [name],
                    ),
                  ]
                : []),
            ],
          );
        }),
      ),

      // Panel divider
      h.line(
        [
          h.X1(String(MERC_X0)),
          h.Y1(String(MAP_Y0)),
          h.X2(String(MERC_X0)),
          h.Y2(String(MAP_Y1)),
          h.Stroke('#e2e8f0'),
          h.StrokeWidth('1'),
        ],
        [],
      ),
    ],
  );
}
