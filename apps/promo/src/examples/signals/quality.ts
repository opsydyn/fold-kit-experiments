import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

import type { Sample } from './data';
import type { EventDataset } from './events';
export const Bounds = Schema.Struct({
  lower: Schema.Number,
  upper: Schema.Number,
  label: Schema.String,
  support: Schema.NullOr(Schema.Number),
});
export type Bounds = typeof Bounds.Type;
const valued = { value: Schema.Number, bounds: Schema.NullOr(Bounds) };
export const Reading = defineTaggedUnion({
  Observed: valued,
  Estimated: { ...valued, method: Schema.String },
  Missing: { reason: Schema.String },
  Invalid: { raw: Schema.String, reason: Schema.String },
});
export type Reading = typeof Reading.Type;
export const SignalRecord = Schema.Struct({
  id: Schema.String,
  time: Schema.Number,
  latency: Reading,
  errors: Reading,
});
export type SignalRecord = typeof SignalRecord.Type;
export const SourceSnapshot = Schema.Struct({
  revision: Schema.String,
  asOf: Schema.Number,
  updatedAt: Schema.Number,
  staleAfterMs: Schema.Number,
});
export type SourceSnapshot = typeof SourceSnapshot.Type;
const Style = Schema.Struct({
  stroke: Schema.optional(Schema.String),
  fill: Schema.optional(Schema.String),
  dashPattern: Schema.optional(Schema.String),
  opacity: Schema.optional(Schema.Number),
  strokeWidth: Schema.optional(Schema.Number),
  pointRadius: Schema.optional(Schema.Number),
  symbol: Schema.optional(
    Schema.Literals(['circle', 'cross', 'diamond', 'square', 'star', 'triangle', 'wye']),
  ),
});
export const SignalThreshold = Schema.Struct({
  id: Schema.String,
  metric: Schema.Literals(['latency', 'errors']),
  value: Schema.Number,
  label: Schema.String,
  style: Style,
});
export type SignalThreshold = typeof SignalThreshold.Type;
export const Props = Schema.Struct({
  events: Schema.optional(Schema.Unknown),
  data: Schema.Array(SignalRecord),
  snapshot: SourceSnapshot,
  maxGapMs: Schema.Number,
  thresholds: Schema.Array(SignalThreshold),
  scenarioAsOf: Schema.Struct({ Fresh: Schema.Number, Stale: Schema.Number }),
});
export type Props = Omit<typeof Props.Type, 'events'> & { readonly events?: EventDataset };
export type ObservationProps = Omit<typeof Props.Type, 'events'>;
const nonempty = (text: string) => text.trim().length > 0;
const usableTime = (time: number) => Number.isFinite(time) && Math.abs(time) <= 8.64e15;
export const validSourceSnapshot = (s: SourceSnapshot): boolean =>
  nonempty(s.revision) &&
  usableTime(s.asOf) &&
  usableTime(s.updatedAt) &&
  s.updatedAt <= s.asOf &&
  Number.isFinite(s.asOf - s.updatedAt) &&
  Number.isFinite(s.staleAfterMs) &&
  s.staleAfterMs >= 0;
export function sourceFreshness(snapshot: SourceSnapshot): 'Fresh' | 'Stale' {
  if (!validSourceSnapshot(snapshot))
    throw new RangeError(
      'Provide usable source snapshot times and a non-negative freshness cutoff.',
    );
  return snapshot.asOf - snapshot.updatedAt <= snapshot.staleAfterMs ? 'Fresh' : 'Stale';
}
export const readingValue = (reading: Reading): number | null =>
  Reading.match(reading, {
    Observed: (r) => r.value,
    Estimated: (r) => r.value,
    Missing: () => null,
    Invalid: () => null,
  });
export const readingText = (reading: Reading): string =>
  Reading.match(reading, {
    Observed: (r) => String(r.value),
    Estimated: (r) => String(r.value),
    Missing: (r) => `Missing — ${r.reason}`,
    Invalid: (r) => `Invalid (${r.raw}) — ${r.reason}`,
  });
export const readingBounds = (reading: Reading): Bounds | null =>
  Reading.match(reading, {
    Observed: (r) => r.bounds,
    Estimated: (r) => r.bounds,
    Missing: () => null,
    Invalid: () => null,
  });
const validValue = (v: number, metric: 'latency' | 'errors') =>
  Number.isFinite(v) && v >= 0 && (metric === 'latency' || v <= 100) && Number.isFinite(v * 1.1);
export function classifyReading(value: number | null, metric: 'latency' | 'errors'): Reading {
  if (value === null) return Reading.Missing({ reason: 'No measurement supplied' });
  return validValue(value, metric)
    ? Reading.Observed({ value, bounds: null })
    : Reading.Invalid({
        raw: String(value),
        reason: 'Value is non-finite or outside the metric range',
      });
}
export const observedRecords = (samples: ReadonlyArray<Sample>): ReadonlyArray<SignalRecord> =>
  samples.map((d) => ({
    id: d.id,
    time: d.time,
    latency: Reading.Observed({ value: d.latencyMs, bounds: null }),
    errors: Reading.Observed({ value: d.errorPercent, bounds: null }),
  }));
const validReading = (reading: Reading, metric: 'latency' | 'errors'): boolean =>
  Reading.match(reading, {
    Missing: (r) => nonempty(r.reason),
    Invalid: (r) => nonempty(r.reason),
    Observed: (r) => validValuedReading(r, metric),
    Estimated: (r) => nonempty(r.method) && validValuedReading(r, metric),
  });
function validValuedReading(
  r: { readonly value: number; readonly bounds: Bounds | null },
  metric: 'latency' | 'errors',
): boolean {
  const b = r.bounds;
  return (
    validValue(r.value, metric) &&
    (b === null ||
      (validValue(b.lower, metric) &&
        validValue(b.upper, metric) &&
        b.lower <= r.value &&
        r.value <= b.upper &&
        nonempty(b.label) &&
        (b.support === null || (Number.isSafeInteger(b.support) && b.support >= 0))))
  );
}
/** Schema decoding precedes this semantic validation. No input is repaired or discarded. */
export function validSignalProps(props: ObservationProps): boolean {
  if (
    !validSourceSnapshot(props.snapshot) ||
    !Number.isFinite(props.maxGapMs) ||
    props.maxGapMs <= 0
  )
    return false;
  const fresh = { ...props.snapshot, asOf: props.scenarioAsOf.Fresh },
    stale = { ...props.snapshot, asOf: props.scenarioAsOf.Stale };
  if (
    !validSourceSnapshot(fresh) ||
    !validSourceSnapshot(stale) ||
    sourceFreshness(fresh) !== 'Fresh' ||
    sourceFreshness(stale) !== 'Stale'
  )
    return false;
  const ids = new Set<string>(),
    times = new Set<number>(),
    thresholdIds = new Set<string>();
  for (const d of props.data) {
    if (
      !nonempty(d.id) ||
      ids.has(d.id) ||
      !usableTime(d.time) ||
      times.has(d.time) ||
      !validReading(d.latency, 'latency') ||
      !validReading(d.errors, 'errors')
    )
      return false;
    ids.add(d.id);
    times.add(d.time);
  }
  for (const t of props.thresholds) {
    const s = t.style;
    if (
      !nonempty(t.id) ||
      thresholdIds.has(t.id) ||
      !nonempty(t.label) ||
      !validValue(t.value, t.metric) ||
      (s.opacity !== undefined &&
        (!Number.isFinite(s.opacity) || s.opacity < 0 || s.opacity > 1)) ||
      [s.strokeWidth, s.pointRadius].some((v) => v !== undefined && (!Number.isFinite(v) || v < 0))
    )
      return false;
    thresholdIds.add(t.id);
  }
  return true;
}
