import { Schema } from 'effect';
export const Sample = Schema.Struct({
  id: Schema.String,
  time: Schema.Number,
  latencyMs: Schema.Number,
  errorPercent: Schema.Number,
});
export type Sample = typeof Sample.Type;
export const signalData: ReadonlyArray<Sample> = Array.from({ length: 120 }, (_, i) => ({
  id: `signal-${String(i).padStart(3, '0')}`,
  time: 1700000000000 + i * 1000,
  latencyMs: 80 + ((i * 17) % 23) + (i >= 48 && i <= 54 ? 200 : 0),
  errorPercent: (2 + (i % 5) + (i >= 50 && i <= 57 ? 40 : 0)) / 10,
}));
