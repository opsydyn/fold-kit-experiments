import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import { intervalBandGeometry } from '@opsydyn/foldkit-viz/chart/intervalBand';
import { contiguousRuns } from '@opsydyn/foldkit-viz/chart/segments';
import { nearestByX } from '@opsydyn/foldkit-viz/interaction/inspection';
import { line } from '@opsydyn/foldkit-viz/shape/line';

import type { ReadyModel, ChartRole } from './model';
import { readingValue, readingBounds, sourceFreshness } from './quality';
import type { SignalRecord } from './quality';
export const deriveSignalChart = (model: ReadyModel, role: ChartRole) => {
  const domain = role === 'overview' ? model.bounds : model.viewport;
  const frame = {
    width: model.widths[role],
    height: role === 'overview' ? 140 : 260,
    margins: { top: 24, right: 20, bottom: 36, left: 56 },
  };
  const metric = role === 'errors' ? 'errors' : 'latency';
  const reading = (d: SignalRecord) => d[metric];
  const value = (d: SignalRecord) => readingValue(reading(d)) ?? NaN;
  const thresholds = model.thresholds.filter((t) => t.metric === metric);
  const extents = model.records.flatMap((d) => {
    const v = readingValue(reading(d)),
      b = readingBounds(reading(d));
    return v === null ? [] : [v, ...(b === null ? [] : [b.lower, b.upper])];
  });
  const maximum = Math.max(0, ...extents, ...thresholds.map((t) => t.value));
  const upper = maximum > 0 ? maximum * 1.1 : 1;
  const visible = model.records.filter((d) => d.time >= domain[0] && d.time <= domain[1]);
  const base = lineGeometry(
    model.records,
    { datumKey: (d) => d.id, seriesKey: () => role, x: (d) => d.time, y: value },
    {
      frame,
      xDomain: domain,
      yDomain: [0, upper],
      xTickCount: frame.width < 420 ? 2 : 4,
      yTickCount: 4,
    },
  );
  const connect = (a: SignalRecord, b: SignalRecord) =>
    b.time - a.time <= model.maxGapMs && reading(a)._tag === reading(b)._tag;
  const runs = contiguousRuns(model.records, {
    x: (d) => d.time,
    defined: (d) => readingValue(reading(d)) !== null,
    connect,
  }).map((records) => {
    const quality =
      records[0] && reading(records[0])._tag === 'Estimated'
        ? ('Estimated' as const)
        : ('Observed' as const);
    return {
      quality,
      records,
      path: line(
        records.map((d) => [base.layout.x(d.time), base.layout.y(value(d))] as const),
        { curve: 'linear' },
      ),
    };
  });
  const geometry = {
    ...base,
    series: runs.map((run, i) => {
      const keys = new Set(run.records.map((d) => d.id));
      return {
        key: `${role}-${i}`,
        path: run.path ?? '',
        points: base.points.filter((p) => keys.has(p.key)),
      };
    }),
  };
  const bands = contiguousRuns(model.records, {
    x: (d) => d.time,
    defined: (d) => readingBounds(reading(d)) !== null,
    connect,
  }).map((records) =>
    intervalBandGeometry(
      records,
      {
        x: (d) => d.time,
        lower: (d) => readingBounds(reading(d))?.lower ?? NaN,
        upper: (d) => readingBounds(reading(d))?.upper ?? NaN,
        datumKey: (d) => d.id,
      },
      base.layout,
    ),
  );
  const qualitySpans = contiguousRuns(model.records, {
    x: (d) => d.time,
    defined: (d) => reading(d)._tag === 'Missing' || reading(d)._tag === 'Invalid',
    connect,
  }).flatMap((records) => {
    const first = records[0],
      last = records.at(-1);
    if (!first || !last) return [];
    const status = reading(first)._tag === 'Missing' ? ('Missing' as const) : ('Invalid' as const);
    return [{ status, start: first.time, end: last.time, keys: records.map((d) => d.id) }];
  });
  const gaps: Array<Readonly<{ start: number; end: number }>> = [];
  for (let i = 1; i < model.records.length; i++) {
    const a = model.records[i - 1],
      b = model.records[i];
    if (a && b && b.time - a.time > model.maxGapMs) gaps.push({ start: a.time, end: b.time });
  }
  const noDrawable = !runs.some((run) => {
    const first = run.records[0],
      last = run.records.at(-1);
    return (
      first !== undefined && last !== undefined && first.time <= domain[1] && last.time >= domain[0]
    );
  });
  const inspected = model.records.find((d) => d.id === model.inspection.key) ?? null;
  return {
    frame,
    geometry,
    visible,
    inspected,
    runs,
    bands,
    qualitySpans,
    gaps,
    thresholds,
    noDrawable,
    freshness: sourceFreshness(model.snapshot),
  };
};
export const visibleRecords = (model: ReadyModel) =>
  model.records.filter((d) => d.time >= model.viewport[0] && d.time <= model.viewport[1]);
export const nearestVisible = (model: ReadyModel, time: number) =>
  nearestByX(visibleRecords(model), { key: (d) => d.id, x: (d) => d.time }, time);
export const utc = (time: number) => new Date(time).toISOString();
export const inspectionNotice = (model: ReadyModel): string => {
  const record = model.records.find((d) => d.id === model.inspection.key);
  if (record)
    return `${model.inspection._tag === 'Pinned' ? 'Pinned' : 'Following'} ${record.id}${record.time < model.viewport[0] || record.time > model.viewport[1] ? ' — outside current view' : ''}`;
  return visibleRecords(model).length === 0
    ? 'No observation in current view. Zoom out to find a signal.'
    : 'Hover or focus a detail chart to inspect an observation.';
};
export const currentSignalSource = (
  model: ReadyModel,
): string => `// Controlled state; all timestamps are UTC milliseconds.
import { zoomDomain, panDomain } from '@opsydyn/foldkit-viz/interaction/viewport';
import { nearestByX } from '@opsydyn/foldkit-viz/interaction/inspection';
const bounds = ${JSON.stringify(model.bounds)};
const viewport = ${JSON.stringify(model.viewport)};
const selection = ${JSON.stringify(model.selection)};
const inspection = ${JSON.stringify(model.inspection)};
const snapshot = ${JSON.stringify(model.snapshot)};
const freshness = ${JSON.stringify(sourceFreshness(model.snapshot))};
const maxGapMs = ${JSON.stringify(model.maxGapMs)};
const thresholds = ${JSON.stringify(model.thresholds)};
const inspectedRecord = ${JSON.stringify(model.records.find((d) => d.id === model.inspection.key) ?? null)};
const minimumSpan = 1000;
// Use viewport to derive both charts; selection and inspection remain independent.
`;
