import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { resolveSeriesStyle } from '@opsydyn/foldkit-viz/chart/theme';
import { lineSeries, pointSeries } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { line } from '@opsydyn/foldkit-viz/shape/line';

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
export const qualityLegend = (h: Html.H<Message>): View.Content<Message> =>
  h.ul
    .attr('class', 'signal-quality-legend')
    .attr('aria-label', 'Signal quality legend')
    .children(
      h.li.children('━ Observed · solid'),
      h.li.children('◇ Estimated · dashed / hollow diamond'),
      h.li.children('M Missing · no measured value'),
      h.li.children('! Invalid · raw diagnostic retained'),
      h.li.children('G Gap · no records'),
      h.li.children('▱ caller-supplied interval · no statistical inference'),
    );
export const qualityLayers = (
  model: ReadyModel,
  role: ChartRole,
  chart: ReturnType<typeof deriveSignalChart>,
  h: Html.H<Message>,
  selectedIntervalKeys: ReadonlySet<string>,
): ReadonlyArray<View.Content<Message>> => {
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
  const layers: View.Content<Message>[] = [];
  for (const band of chart.bands) {
    if (band.path !== null)
      layers.push(
        h
          .el('path')
          .attr('class', 'signal-band')
          .attr('d', band.path)
          .attr('fill', colour)
          .attr('fill-opacity', '0.12')
          .attr('stroke', 'none')
          .children(),
      );
    const equal = band.points.every((p) => p.lowerY === p.upperY);
    if (band.points.length === 1 || equal) {
      for (const p of band.points) {
        // Selected intervals are owned by the comparison layer; bands remain intact.
        if (selectedIntervalKeys.has(p.key)) continue;
        layers.push(
          h
            .el('g')
            .attr('class', 'signal-interval-mark')
            .attr('aria-label', `Supplied interval for ${p.key}`)
            .children(
              h
                .el('line')
                .attr('x1', String(p.x))
                .attr('x2', String(p.x))
                .attr('y1', String(p.lowerY))
                .attr('y2', String(p.upperY))
                .attr('stroke', colour)
                .children(),
              ...[...new Set([p.lowerY, p.upperY])].map((y) =>
                h
                  .el('line')
                  .attr('x1', String(p.x - 4))
                  .attr('x2', String(p.x + 4))
                  .attr('y1', String(y))
                  .attr('y2', String(y))
                  .attr('stroke', colour)
                  .children(),
              ),
            ),
        );
      }
    }
    for (const side of ['lowerY', 'upperY'] as const) {
      const path = line(band.points.map((p) => [p.x, p[side]] as const));
      if (path)
        layers.push(
          h
            .el('path')
            .attr('d', path)
            .attr('fill', 'none')
            .attr('stroke', colour)
            .attr('stroke-width', '1')
            .attr('stroke-dasharray', '1 3')
            .children(),
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
      h
        .el('line')
        .attr('data-threshold-id', threshold.id)
        .attr(
          'aria-label',
          `${threshold.label}: ${threshold.value} ${role === 'errors' ? '%' : 'ms'}`,
        )
        .attr('x1', String(plot.left))
        .attr('x2', String(plot.right))
        .attr('y1', String(y))
        .attr('y2', String(y))
        .attr('stroke', t.stroke)
        .attr('stroke-width', String(t.strokeWidth))
        .attr('stroke-dasharray', t.dashPattern)
        .attr('opacity', String(t.opacity))
        .children(),
    );
  }
  const lane: View.Content<Message>[] = [];
  for (const span of [
    ...chart.qualitySpans,
    ...chart.gaps.map((g) => ({ ...g, status: 'Gap' as const, keys: [] })),
  ]) {
    if (span.end < layout.xDomain[0] || span.start > layout.xDomain[1]) continue;
    const x = Math.max(plot.left, layout.x(span.start)),
      end = Math.min(plot.right, layout.x(span.end)),
      y = plot.bottom + 26;
    const label = span.status === 'Missing' ? 'M' : span.status === 'Invalid' ? '!' : 'G';
    lane.push(
      h
        .el('g')
        .attr(
          'aria-label',
          `${span.status}: ${span.keys.length > 0 ? span.keys.join(', ') : `${span.end - span.start} ms between records`}`,
        )
        .attr('data-quality-status', span.status)
        .children(
          h
            .el('line')
            .attr('x1', String(x))
            .attr('x2', String(Math.max(x + 2, end)))
            .attr('y1', String(y + 3))
            .attr('y2', String(y + 3))
            .attr('stroke', 'var(--muted)')
            .attr('stroke-width', '2')
            .attr(
              'stroke-dasharray',
              span.status === 'Missing' ? '2 2' : span.status === 'Gap' ? '1 4' : '',
            )
            .children(),
          h
            .el('text')
            .attr('x', String(Math.min(x + 2, plot.right - 8)))
            .attr('y', String(y + 15))
            .attr('font-size', '10')
            .attr('fill', 'var(--text)')
            .children(label),
        ),
    );
  }
  return [
    h.el('g').attr('clip-path', `url(#signal-quality-clip-${role})`).children(layers),
    h.el('g').attr('class', 'signal-quality-lane').children(lane),
  ];
};
