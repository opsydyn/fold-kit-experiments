import type { CartesianLayout } from '@opsydyn/foldkit-viz/chart/cartesian';
import { errorBarGeometry } from '@opsydyn/foldkit-viz/chart/errorBars';
import type { ErrorBarMark } from '@opsydyn/foldkit-viz/chart/errorBars';
import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

import { Baseline } from './baseline';
import type { ReadyModel, ChartRole } from './model';
import { Reading, readingValue, readingBounds } from './quality';
import type { SignalRecord } from './quality';
export type Metric = 'latency' | 'errors';
const metricSchema = Schema.Literals(['latency', 'errors']);
export const MetricComparison = defineTaggedUnion({
  Available: {
    metric: metricSchema,
    current: Reading,
    baseline: Reading,
    delta: Schema.Number,
    unit: Schema.Literals(['ms', 'percentage points']),
  },
  Unavailable: {
    metric: metricSchema,
    current: Schema.NullOr(Reading),
    baseline: Schema.NullOr(Reading),
    reason: Schema.Literals(['NoBaseline', 'NoCurrent', 'NonNumeric']),
  },
});
export type MetricComparison = typeof MetricComparison.Type;
export const compareReading = (
  metric: Metric,
  current: Reading | null,
  baseline: Reading | null,
): MetricComparison => {
  if (baseline === null)
    return MetricComparison.Unavailable({ metric, current, baseline, reason: 'NoBaseline' });
  if (current === null)
    return MetricComparison.Unavailable({ metric, current, baseline, reason: 'NoCurrent' });
  const a = readingValue(current),
    b = readingValue(baseline);
  if (a === null || b === null)
    return MetricComparison.Unavailable({ metric, current, baseline, reason: 'NonNumeric' });
  return MetricComparison.Available({
    metric,
    current,
    baseline,
    delta: a - b,
    unit: metric === 'latency' ? 'ms' : 'percentage points',
  });
};
export const deriveSignalComparison = (model: ReadyModel) => {
  const current = model.records.find((d) => d.id === model.inspection.key) ?? null;
  const record = Baseline.match(model.baseline, { None: () => null, Captured: (b) => b.record });
  return {
    current,
    baseline: model.baseline,
    baselineOutsideView:
      record !== null && (record.time < model.viewport[0] || record.time > model.viewport[1]),
    latency: compareReading('latency', current?.latency ?? null, record?.latency ?? null),
    errors: compareReading('errors', current?.errors ?? null, record?.errors ?? null),
  };
};
export type ComparisonBar = Readonly<{
  purpose: 'inspection' | 'baseline' | 'both';
  mark: ErrorBarMark<SignalRecord>;
}>;
export type ComparisonChart = Readonly<{
  errorBars: ReadonlyArray<ComparisonBar>;
  baselineReference: Readonly<{ record: SignalRecord; reading: Reading; value: number }> | null;
}>;
export const deriveComparisonChart = (
  model: ReadyModel,
  role: ChartRole,
  layout: CartesianLayout,
): ComparisonChart => {
  const metric = role === 'errors' ? 'errors' : 'latency';
  const { current } = deriveSignalComparison(model);
  const baseline = Baseline.match(model.baseline, { None: () => null, Captured: (b) => b.record });
  const selected: Array<Readonly<{ record: SignalRecord; purpose: ComparisonBar['purpose'] }>> = [];
  if (baseline !== null)
    selected.push({ record: baseline, purpose: current?.id === baseline.id ? 'both' : 'baseline' });
  if (current !== null && current.id !== baseline?.id)
    selected.push({ record: current, purpose: 'inspection' });
  const errorBars = selected.flatMap(({ record, purpose }) => {
    const bounds = readingBounds(record[metric]);
    if (bounds === null) return [];
    return errorBarGeometry(
      [record],
      {
        position: (d) => d.time,
        lower: () => bounds.lower,
        upper: () => bounds.upper,
        datumKey: (d) => d.id,
      },
      layout,
      { axis: 'y', capSize: 8 },
    ).map((mark) => ({ purpose, mark }));
  });
  const reading = baseline?.[metric] ?? null,
    value = reading === null ? null : readingValue(reading);
  return {
    errorBars,
    baselineReference:
      baseline !== null && reading !== null && value !== null
        ? { record: baseline, reading, value }
        : null,
  };
};
