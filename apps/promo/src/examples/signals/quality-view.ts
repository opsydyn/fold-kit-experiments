import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { lineSeries, pointSeries } from '@opsydyn/foldkit-viz/foldkit/cartesian';
import { line } from '@opsydyn/foldkit-viz/shape/line';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { exampleTheme } from '#example/frame';

import type { deriveSignalChart } from './derive';
import type { Message } from './message';
import type { ReadyModel, ChartRole } from './model';
import { Reading, readingBounds } from './quality';
export const qualityDetails = (reading: Reading, unit: string): string => {
  const detail = Reading.match(reading, {
    Observed: () => 'Observed',
    Estimated: (r) => `Estimated · ${r.method}`,
    Missing: () => 'Missing',
    Invalid: () => 'Invalid',
  });
  const b = readingBounds(reading);
  return b === null
    ? detail
    : `${detail} · caller-supplied interval “${b.label}”: ${b.lower} → ${b.upper} ${unit} · support: ${b.support === null ? 'unspecified' : b.support}`;
};
export const qualityLegend = (h: HtmlBuilder<Message>): Html =>
  h.ul(
    [h.Class('signal-quality-legend'), h.AriaLabel('Signal quality legend')],
    [
      h.li([], ['━ Observed · solid']),
      h.li([], ['◇ Estimated · dashed / hollow diamond']),
      h.li([], ['M Missing · no measured value']),
      h.li([], ['! Invalid · raw diagnostic retained']),
      h.li([], ['G Gap · no records']),
      h.li([], ['▱ caller-supplied interval · no statistical inference']),
    ],
  );
export const qualityLayers = (
  model: ReadyModel,
  role: ChartRole,
  chart: ReturnType<typeof deriveSignalChart>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const { plot } = chart.geometry.layout,
    layout = chart.geometry.layout;
  const colour =
    role === 'errors'
      ? 'var(--chart-series-b, var(--coral))'
      : 'var(--chart-series-a, var(--blue))';
  const style = resolveSeriesStyle(
    exampleTheme,
    { stroke: colour, fill: colour, strokeWidth: 2.5 },
    {},
    {},
  );
  const layers: Html[] = [];
  for (const band of chart.bands) {
    if (band.path !== null)
      layers.push(
        h.path(
          [
            h.Class('signal-band'),
            h.D(band.path),
            h.Fill(colour),
            h.FillOpacity('0.12'),
            h.Stroke('none'),
          ],
          [],
        ),
      );
    const equal = band.points.every((p) => p.lowerY === p.upperY);
    if (band.points.length === 1 || equal) {
      for (const p of band.points)
        layers.push(
          h.g(
            [h.Class('signal-interval-mark'), h.AriaLabel(`Supplied interval for ${p.key}`)],
            [
              h.line(
                [
                  h.X1(String(p.x)),
                  h.X2(String(p.x)),
                  h.Y1(String(p.lowerY)),
                  h.Y2(String(p.upperY)),
                  h.Stroke(colour),
                ],
                [],
              ),
              ...[p.lowerY, p.upperY].map((y) =>
                h.line(
                  [
                    h.X1(String(p.x - 4)),
                    h.X2(String(p.x + 4)),
                    h.Y1(String(y)),
                    h.Y2(String(y)),
                    h.Stroke(colour),
                  ],
                  [],
                ),
              ),
            ],
          ),
        );
    }
    for (const side of ['lowerY', 'upperY'] as const) {
      const path = line(band.points.map((p) => [p.x, p[side]] as const));
      if (path)
        layers.push(
          h.path(
            [
              h.D(path),
              h.Fill('none'),
              h.Stroke(colour),
              h.StrokeWidth('1'),
              h.StrokeDasharray('1 3'),
            ],
            [],
          ),
        );
    }
  }
  for (const run of chart.runs) {
    if (run.path)
      layers.push(
        lineSeries(h, {
          path: run.path,
          style: { ...style, dashPattern: run.quality === 'Estimated' ? '7 4' : '' },
        }),
      );
    const endpoints = new Set(
      run.records.length === 1
        ? run.records.map((d) => d.id)
        : run.quality === 'Estimated'
          ? [run.records[0]?.id, run.records.at(-1)?.id]
          : [],
    );
    layers.push(
      pointSeries(h, {
        points: chart.geometry.points.filter((p) => endpoints.has(p.key)),
        styleFor: () => ({
          ...style,
          pointRadius: 3,
          symbol: run.quality === 'Estimated' ? 'diamond' : 'circle',
          fill: run.quality === 'Estimated' ? 'var(--surface)' : colour,
        }),
        labelFor: (d) => `${d.id}, ${run.quality}`,
        activeKey: model.inspection.key,
      }),
    );
  }
  for (const threshold of chart.thresholds) {
    const defaults = resolveSeriesStyle(
      exampleTheme,
      { stroke: 'var(--muted)', strokeWidth: 1, dashPattern: '2 4' },
      {},
      {},
    );
    const t = {
      stroke: threshold.style.stroke ?? defaults.stroke,
      fill: threshold.style.fill ?? defaults.fill,
      opacity: threshold.style.opacity ?? defaults.opacity,
      strokeWidth: threshold.style.strokeWidth ?? defaults.strokeWidth,
      pointRadius: threshold.style.pointRadius ?? defaults.pointRadius,
      symbol: threshold.style.symbol ?? defaults.symbol,
      dashPattern: threshold.style.dashPattern ?? defaults.dashPattern,
    };
    const y = layout.y(threshold.value);
    layers.push(
      h.line(
        [
          h.DataAttribute('threshold-id', threshold.id),
          h.AriaLabel(`${threshold.label}: ${threshold.value} ${role === 'errors' ? '%' : 'ms'}`),
          h.X1(String(plot.left)),
          h.X2(String(plot.right)),
          h.Y1(String(y)),
          h.Y2(String(y)),
          h.Stroke(t.stroke),
          h.StrokeWidth(String(t.strokeWidth)),
          h.StrokeDasharray(t.dashPattern),
          h.Opacity(String(t.opacity)),
        ],
        [],
      ),
    );
  }
  const lane: Html[] = [];
  for (const span of [
    ...chart.qualitySpans,
    ...chart.gaps.map((g) => ({ ...g, status: 'Gap' as const, keys: [] })),
  ]) {
    if (span.end < layout.xDomain[0] || span.start > layout.xDomain[1]) continue;
    const x = Math.max(plot.left, layout.x(span.start)),
      end = Math.min(plot.right, layout.x(span.end)),
      y = plot.bottom + 42;
    const label = span.status === 'Missing' ? 'M' : span.status === 'Invalid' ? '!' : 'G';
    lane.push(
      h.g(
        [
          h.AriaLabel(
            `${span.status}: ${span.keys.length > 0 ? span.keys.join(', ') : `${span.end - span.start} ms between records`}`,
          ),
          h.DataAttribute('quality-status', span.status),
        ],
        [
          h.line(
            [
              h.X1(String(x)),
              h.X2(String(Math.max(x + 2, end))),
              h.Y1(String(y + 3)),
              h.Y2(String(y + 3)),
              h.Stroke('var(--muted)'),
              h.StrokeWidth('2'),
              h.StrokeDasharray(
                span.status === 'Missing' ? '2 2' : span.status === 'Gap' ? '1 4' : '',
              ),
            ],
            [],
          ),
          h.text(
            [
              h.X(String(Math.min(x + 2, plot.right - 8))),
              h.Y(String(y + 15)),
              h.FontSize('10'),
              h.Fill('var(--text)'),
            ],
            [label],
          ),
        ],
      ),
    );
  }
  return [
    h.g([h.Attribute('clip-path', `url(#signal-quality-clip-${role})`)], layers),
    h.g([h.Class('signal-quality-lane')], lane),
  ];
};
