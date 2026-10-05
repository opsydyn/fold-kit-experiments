import { signalData } from './data';
import { eventDataset } from './events-data';
import { Reading, observedRecords } from './quality';
import type { Props, SignalRecord } from './quality';
const t0 = 1700000000000;
export const freshSnapshot = {
  revision: 'signal-quality-v1',
  updatedAt: t0 + 119000,
  asOf: t0 + 124000,
  staleAfterMs: 10000,
};
export const staleSnapshot = { ...freshSnapshot, asOf: t0 + 134001 };
export const qualityData: ReadonlyArray<SignalRecord> = observedRecords(signalData).flatMap(
  (d, i) => {
    if (i >= 70 && i <= 74) return [];
    if (i >= 10 && i <= 14)
      return [{ ...d, latency: Reading.Missing({ reason: 'collector unavailable' }) }];
    if (i === 22)
      return [
        {
          ...d,
          errors: Reading.Invalid({ raw: 'NaN', reason: 'collector emitted non-finite value' }),
        },
      ];
    if (i === 40)
      return [
        {
          ...d,
          latency: Reading.Observed({ value: 0, bounds: null }),
          errors: Reading.Observed({ value: 0, bounds: null }),
        },
      ];
    if (i >= 30 && i <= 39) {
      const base = signalData[i];
      if (!base) throw new RangeError('Missing quality fixture');
      const label = 'Illustrative supplied range',
        method = 'illustrative interpolation';
      return [
        {
          ...d,
          latency: Reading.Estimated({
            value: base.latencyMs,
            bounds: {
              lower: base.latencyMs - 8,
              upper: base.latencyMs + 8,
              label,
              support: i === 35 ? 0 : 3,
            },
            method,
          }),
          errors: Reading.Estimated({
            value: base.errorPercent,
            bounds: {
              lower: Math.max(0, base.errorPercent - 0.1),
              upper: Math.min(100, base.errorPercent + 0.1),
              label,
              support: 3,
            },
            method,
          }),
        },
      ];
    }
    return [d];
  },
);
export const qualityProps: Props = {
  events: eventDataset,
  data: qualityData,
  snapshot: freshSnapshot,
  maxGapMs: 1500,
  thresholds: [
    {
      id: 'latency-reference',
      metric: 'latency',
      value: 180,
      label: 'Latency reference',
      style: { dashPattern: '2 4' },
    },
    {
      id: 'errors-reference',
      metric: 'errors',
      value: 2,
      label: 'Error reference',
      style: { dashPattern: '2 4' },
    },
  ],
  scenarioAsOf: { Fresh: freshSnapshot.asOf, Stale: staleSnapshot.asOf },
};
