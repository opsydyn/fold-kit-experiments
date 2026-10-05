import { defineTaggedUnion } from 'foldkit/schema';

import { Reading, SignalRecord, SourceSnapshot } from './quality';

export const Baseline = defineTaggedUnion({
  None: {},
  Captured: { record: SignalRecord, snapshot: SourceSnapshot },
});
export type Baseline = typeof Baseline.Type;
const copyReading = (reading: Reading): Reading =>
  Reading.match(reading, {
    Observed: (r) => Reading.Observed({ ...r, bounds: r.bounds === null ? null : { ...r.bounds } }),
    Estimated: (r) =>
      Reading.Estimated({ ...r, bounds: r.bounds === null ? null : { ...r.bounds } }),
    Missing: (r) => Reading.Missing({ reason: r.reason }),
    Invalid: (r) => Reading.Invalid({ raw: r.raw, reason: r.reason }),
  });
/** Capture model-owned evidence, including independent nested supplied bounds. */
export const captureBaseline = (
  record: SignalRecord,
  snapshot: SourceSnapshot,
): Extract<Baseline, { _tag: 'Captured' }> =>
  Baseline.Captured({
    record: { ...record, latency: copyReading(record.latency), errors: copyReading(record.errors) },
    snapshot: { ...snapshot },
  });
