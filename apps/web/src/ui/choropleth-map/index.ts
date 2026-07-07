import { interpolateRgb } from '@opsydyn/foldkit-viz/math/color';
import { scaleSequential } from '@opsydyn/foldkit-viz/math/scale';
import type { GeoFeatureCollection } from '@opsydyn/foldkit-viz/shape/geo';
import { geoNaturalEarth1, geoPath } from '@opsydyn/foldkit-viz/shape/geo';
import { Match, Option, Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';

import type { Dims, Layout, Margins } from '../shared';
import { makeLayout, r3, svgRoot } from '../shared';

// MODEL — choropleth map
// Features come in as a GeoFeatureCollection (post-topojson conversion).
// Each feature's `id` is matched against the data array to color it.

export type ChoroplethDatum = Readonly<{
  id: string;
  label: string;
  value: number;
}>;

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
    },
    [],
  ];
}

// MESSAGE

export const HoveredFeature = m('HoveredFeature', { id: Schema.String });
export const BlurredFeature = m('BlurredFeature', {});

export const Message = Schema.Union([HoveredFeature, BlurredFeature]);
export type Message = typeof Message.Type;

// UPDATE

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      HoveredFeature: ({ id }) => [{ ...model, activeId: Option.some(id) }, []],
      BlurredFeature: () => [{ ...model, activeId: Option.none() }, []],
    }),
  );

// VIEW

export function view<M>(config: {
  model: Model;
  toParentMessage: (msg: Message) => M;
  ariaLabel?: string;
}): Html {
  const h = html<M>();
  const { model, toParentMessage, ariaLabel = 'Choropleth world map' } = config;
  const {
    features,
    dataById,
    colorLow,
    colorHigh,
    noDataColor,
    legendLabel,
    valueExtent,
    activeId,
  } = model;
  const {
    dims: { width: W, height: H },
    margins: { top: MT, left: ML },
    pw: PW,
    ph: PH,
  } = model.layout;

  const activeFeatureId = Option.isSome(activeId) ? activeId.value : null;
  const colorScale = scaleSequential(valueExtent, interpolateRgb(colorLow, colorHigh));

  // Fit the projection to the plot area
  const proj = geoNaturalEarth1().fitSize([PW, PH], { type: 'Sphere' });
  const path = geoPath(proj);

  // Legend
  const legendH = Math.min(PH - 16, 120);
  const legendX = PW + 8;
  const legendSteps = 24;

  // Active datum for tooltip overlay
  const activeDatum = activeFeatureId ? dataById.get(activeFeatureId) : null;
  const activeFeature = activeFeatureId
    ? features.features.find((f) => String(f.properties?.id ?? '') === activeFeatureId)
    : null;
  const activeCentroid = activeFeature?.geometry ? path.centroid(activeFeature) : null;

  return svgRoot(h, { width: W, height: H, ariaLabel }, null, [
    h.g(
      [h.Transform(`translate(${ML},${MT})`)],
      [
        // Country paths
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
                h.StrokeWidth(isActive ? '1.5' : '0.4'),
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

        // Hover tooltip
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
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X('0'),
                      h.Y('-4'),
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

        // Legend
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
