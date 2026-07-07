import { interpolateRgb } from '@opsydyn/foldkit-viz/math/color';
import { scaleSequential } from '@opsydyn/foldkit-viz/math/scale';
import {
  constrainScale,
  identityMatrix,
  matrixToString,
  scaleAt,
  type TransformMatrix,
  translateBy,
} from '@opsydyn/foldkit-viz/math/zoom';
import type { GeoFeatureCollection } from '@opsydyn/foldkit-viz/shape/geo';
import { geoNaturalEarth1, geoPath } from '@opsydyn/foldkit-viz/shape/geo';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

import type { ChoroplethDatum } from '../choropleth-map';
import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot } from '../shared';

export type { ChoroplethDatum };

export type InitConfig = Readonly<{
  features: GeoFeatureCollection;
  data: ReadonlyArray<ChoroplethDatum>;
  colorLow?: string;
  colorHigh?: string;
  noDataColor?: string;
  legendLabel?: string;
  dims?: Partial<Dims>;
  margins?: Partial<Margins>;
}>;

export type Model = Readonly<{
  features: GeoFeatureCollection;
  dataById: ReadonlyMap<string, ChoroplethDatum>;
  colorLow: string;
  colorHigh: string;
  noDataColor: string;
  legendLabel: string;
  valueExtent: readonly [number, number];
  activeId: Option.Option<string>;
  layout: Layout;
  // zoom state
  matrix: TransformMatrix;
  isDragging: boolean;
  dragX: number;
  dragY: number;
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const values = cfg.data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const dataById = new Map(cfg.data.map((d) => [d.id, d]));

  const layout = makeLayout(
    { width: 760, height: 420, ...cfg.dims },
    { top: 12, right: 80, bottom: 16, left: 12, ...cfg.margins },
  );

  return [
    {
      features: cfg.features,
      dataById,
      colorLow: cfg.colorLow ?? '#dbeafe',
      colorHigh: cfg.colorHigh ?? '#1d4ed8',
      noDataColor: cfg.noDataColor ?? '#2d2d2d',
      legendLabel: cfg.legendLabel ?? '',
      valueExtent: [lo, hi],
      activeId: Option.none(),
      layout,
      matrix: identityMatrix(),
      isDragging: false,
      dragX: 0,
      dragY: 0,
    },
    [],
  ];
}

// MESSAGE

export const HoveredFeature = m('HoveredFeature', { id: Schema.String });
export const BlurredFeature = m('BlurredFeature', {});
export const ClickedZoomIn = m('ClickedZoomIn', {});
export const ClickedZoomOut = m('ClickedZoomOut', {});
export const ClickedReset = m('ClickedReset', {});
export const PointerDowned = m('PointerDowned', { x: Schema.Number, y: Schema.Number });
export const PointerMoved = m('PointerMoved', { x: Schema.Number, y: Schema.Number });
export const PointerUpped = m('PointerUpped', {});

export const Message = Schema.Union([
  HoveredFeature,
  BlurredFeature,
  ClickedZoomIn,
  ClickedZoomOut,
  ClickedReset,
  PointerDowned,
  PointerMoved,
  PointerUpped,
]);
export type Message = typeof Message.Type;

// UPDATE

const MIN_SCALE = 0.8;
const MAX_SCALE = 16;
const ZOOM_FACTOR = 1.4;

function zoomCenter(model: Model): { x: number; y: number } {
  return { x: model.layout.pw / 2, y: model.layout.ph / 2 };
}

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredFeature: ({ id }) => [{ ...model, activeId: Option.some(id) }, []],
      BlurredFeature: () => [{ ...model, activeId: Option.none() }, []],
      ClickedZoomIn: () => {
        const zoomed = scaleAt(model.matrix, ZOOM_FACTOR, ZOOM_FACTOR, zoomCenter(model));
        return [
          { ...model, matrix: constrainScale(zoomed, model.matrix, MIN_SCALE, MAX_SCALE) },
          [],
        ];
      },
      ClickedZoomOut: () => {
        const zoomed = scaleAt(model.matrix, 1 / ZOOM_FACTOR, 1 / ZOOM_FACTOR, zoomCenter(model));
        return [
          { ...model, matrix: constrainScale(zoomed, model.matrix, MIN_SCALE, MAX_SCALE) },
          [],
        ];
      },
      ClickedReset: () => [{ ...model, matrix: identityMatrix() }, []],
      PointerDowned: ({ x, y }) => [{ ...model, isDragging: true, dragX: x, dragY: y }, []],
      PointerMoved: ({ x, y }) => {
        if (!model.isDragging) return [model, []];
        const translated = translateBy(model.matrix, x - model.dragX, y - model.dragY);
        return [{ ...model, matrix: translated, dragX: x, dragY: y }, []];
      },
      PointerUpped: () => [{ ...model, isDragging: false }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Zoomable choropleth world map' } = config;
  const {
    features,
    dataById,
    colorLow,
    colorHigh,
    noDataColor,
    legendLabel,
    valueExtent,
    activeId,
    matrix,
    isDragging,
  } = model;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;

  const activeFeatureId = Option.isSome(activeId) ? activeId.value : null;
  const colorScale = scaleSequential(valueExtent, interpolateRgb(colorLow, colorHigh));

  const proj = geoNaturalEarth1().fitSize([PW, PH], { type: 'Sphere' });
  const path = geoPath(proj);

  const legendH = Math.min(PH - 16, 120);
  const legendX = PW + 8;
  const legendSteps = 24;

  const activeDatum = activeFeatureId ? dataById.get(activeFeatureId) : null;
  const activeFeature = activeFeatureId
    ? features.features.find((f) => String(f.properties?.id ?? '') === activeFeatureId)
    : null;
  const activeCentroid = activeFeature?.geometry ? path.centroid(activeFeature) : null;

  // Zoom control button positions (fixed — outside the transformed group)
  const btnY = 4;
  const btnH = 18;
  const btnW = 24;
  const btnGap = 4;
  const btnBaseX = PW - 3 * btnW - 2 * btnGap;
  const btnStyle = { cursor: 'pointer', 'user-select': 'none' as const };

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Invisible overlay rect captures pointer/wheel events over the whole plot
        h.rect(
          [
            h.X('0'),
            h.Y('0'),
            h.Width(String(PW)),
            h.Height(String(PH)),
            h.Fill('transparent'),
            h.Style({ cursor: isDragging ? 'grabbing' : 'grab' }),
            h.OnPointerDown((_, _btn, screenX, screenY) =>
              Option.some(toParentMessage(PointerDowned({ x: screenX, y: screenY }))),
            ),
            h.OnPointerMove((screenX, screenY) =>
              isDragging
                ? Option.some(toParentMessage(PointerMoved({ x: screenX, y: screenY })))
                : Option.none(),
            ),
            h.OnPointerUp(() => Option.some(toParentMessage(PointerUpped()))),
            h.OnPointerLeave(() => Option.some(toParentMessage(PointerUpped()))),
          ],
          [],
        ),

        // Countries group — the transform matrix is applied here for zoom/pan
        h.g(
          [h.Transform(matrixToString(matrix))],
          [
            h.g(
              [],
              features.features.map((feature) => {
                const fid = String(feature.properties?.id ?? '');
                const datum = dataById.get(fid);
                const isActive = fid === activeFeatureId;
                const isDimmed = activeFeatureId !== null && !isActive;
                const color = datum ? colorScale(datum.value) : noDataColor;
                const d = feature.geometry ? path(feature) : '';
                if (!d) return h.g([], []);

                return h.path(
                  [
                    h.D(d),
                    h.Fill(color),
                    h.Stroke('var(--chart-grid, #1a1a2e)'),
                    h.StrokeWidth(
                      isActive ? `${r3(1.5 / matrix.scaleX)}` : `${r3(0.4 / matrix.scaleX)}`,
                    ),
                    h.Opacity(isDimmed ? '0.35' : '1'),
                    h.Style({ cursor: datum ? 'pointer' : 'default', transition: 'opacity 120ms' }),
                    h.OnMouseEnter(toParentMessage(HoveredFeature({ id: fid }))),
                    h.OnMouseLeave(toParentMessage(BlurredFeature())),
                    ...(datum ? [h.AriaLabel(`${datum.label}: ${datum.value}`)] : []),
                  ],
                  [],
                );
              }),
            ),

            // Tooltip rendered inside transformed group (moves with map)
            ...(activeDatum && activeCentroid
              ? [
                  h.g(
                    [
                      h.Transform(`translate(${r3(activeCentroid[0])},${r3(activeCentroid[1])})`),
                      h.Style({ 'pointer-events': 'none' }),
                    ],
                    [
                      h.rect(
                        [
                          h.X('-36'),
                          h.Y('-18'),
                          h.Width('72'),
                          h.Height('22'),
                          h.Fill('var(--chart-tooltip-bg, #0f172a)'),
                          h.Attribute('rx', '3'),
                          h.Opacity('0.9'),
                          // Counter-scale so tooltip text stays readable at any zoom level
                          h.Transform(`scale(${r3(1 / matrix.scaleX)},${r3(1 / matrix.scaleY)})`),
                        ],
                        [],
                      ),
                      h.text(
                        [
                          h.X('0'),
                          h.Y('-4'),
                          h.Transform(`scale(${r3(1 / matrix.scaleX)},${r3(1 / matrix.scaleY)})`),
                          h.Style({
                            'text-anchor': 'middle',
                            'font-size': '0.58rem',
                            'font-weight': '600',
                            fill: 'var(--chart-tooltip-text, #f8fafc)',
                          }),
                        ],
                        [`${activeDatum.label}: ${activeDatum.value}`],
                      ),
                    ],
                  ),
                ]
              : []),
          ],
        ),

        // Zoom controls (fixed — not affected by the matrix transform)
        h.g(
          [h.Attribute('aria-label', 'Zoom controls')],
          [
            // Zoom Out
            h.g(
              [
                h.OnClick(toParentMessage(ClickedZoomOut())),
                h.Style(btnStyle),
                h.AriaLabel('Zoom out'),
              ],
              [
                h.rect(
                  [
                    h.X(String(btnBaseX)),
                    h.Y(String(btnY)),
                    h.Width(String(btnW)),
                    h.Height(String(btnH)),
                    h.Attribute('rx', '3'),
                    h.Fill('#1e293b'),
                    h.Stroke('#334155'),
                    h.StrokeWidth('1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X(String(r3(btnBaseX + btnW / 2))),
                    h.Y(String(r3(btnY + btnH / 2 + 1))),
                    h.Style({
                      'text-anchor': 'middle',
                      'dominant-baseline': 'middle',
                      'font-size': '0.9rem',
                      fill: '#94a3b8',
                      'pointer-events': 'none',
                    }),
                  ],
                  ['−'],
                ),
              ],
            ),
            // Reset
            h.g(
              [
                h.OnClick(toParentMessage(ClickedReset())),
                h.Style(btnStyle),
                h.AriaLabel('Reset zoom'),
              ],
              [
                h.rect(
                  [
                    h.X(String(btnBaseX + btnW + btnGap)),
                    h.Y(String(btnY)),
                    h.Width(String(btnW)),
                    h.Height(String(btnH)),
                    h.Attribute('rx', '3'),
                    h.Fill('#1e293b'),
                    h.Stroke('#334155'),
                    h.StrokeWidth('1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X(String(r3(btnBaseX + btnW + btnGap + btnW / 2))),
                    h.Y(String(r3(btnY + btnH / 2 + 1))),
                    h.Style({
                      'text-anchor': 'middle',
                      'dominant-baseline': 'middle',
                      'font-size': '0.65rem',
                      fill: '#94a3b8',
                      'pointer-events': 'none',
                    }),
                  ],
                  ['⟲'],
                ),
              ],
            ),
            // Zoom In
            h.g(
              [
                h.OnClick(toParentMessage(ClickedZoomIn())),
                h.Style(btnStyle),
                h.AriaLabel('Zoom in'),
              ],
              [
                h.rect(
                  [
                    h.X(String(btnBaseX + 2 * (btnW + btnGap))),
                    h.Y(String(btnY)),
                    h.Width(String(btnW)),
                    h.Height(String(btnH)),
                    h.Attribute('rx', '3'),
                    h.Fill('#1e293b'),
                    h.Stroke('#334155'),
                    h.StrokeWidth('1'),
                  ],
                  [],
                ),
                h.text(
                  [
                    h.X(String(r3(btnBaseX + 2 * (btnW + btnGap) + btnW / 2))),
                    h.Y(String(r3(btnY + btnH / 2 + 1))),
                    h.Style({
                      'text-anchor': 'middle',
                      'dominant-baseline': 'middle',
                      'font-size': '0.9rem',
                      fill: '#94a3b8',
                      'pointer-events': 'none',
                    }),
                  ],
                  ['+'],
                ),
              ],
            ),
          ],
        ),

        // Legend (fixed)
        h.g(
          [h.Transform(`translate(${legendX},0)`), h.Attribute('aria-hidden', 'true')],
          [
            ...Array.from({ length: legendSteps }, (_, i) => {
              const t = i / (legendSteps - 1);
              const v = valueExtent[0] + t * (valueExtent[1] - valueExtent[0]);
              const y = r3((1 - t) * legendH);
              const stepH = r3(legendH / legendSteps) + 1;
              return h.rect(
                [
                  h.X('0'),
                  h.Y(String(y)),
                  h.Width('10'),
                  h.Height(String(stepH)),
                  h.Fill(colorScale(v)),
                ],
                [],
              );
            }),
            h.text(
              [
                h.X('14'),
                h.Y(String(legendH)),
                h.Style({
                  'font-size': '0.6rem',
                  'dominant-baseline': 'middle',
                  fill: 'var(--chart-label, #888)',
                }),
              ],
              [String(valueExtent[0])],
            ),
            h.text(
              [
                h.X('14'),
                h.Y('0'),
                h.Style({
                  'font-size': '0.6rem',
                  'dominant-baseline': 'middle',
                  fill: 'var(--chart-label, #888)',
                }),
              ],
              [String(valueExtent[1])],
            ),
            ...(legendLabel
              ? [
                  h.text(
                    [
                      h.Transform(`translate(-4,${r3(legendH / 2)}) rotate(-90)`),
                      h.Style({
                        'text-anchor': 'middle',
                        'font-size': '0.58rem',
                        fill: 'var(--chart-label-muted, #555)',
                      }),
                    ],
                    [legendLabel],
                  ),
                ]
              : []),
          ],
        ),
      ],
    ),
  ]);
}
