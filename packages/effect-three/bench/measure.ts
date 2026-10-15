/** A small timing harness: warm up, then report the median and p95 per operation. */

export type Measurement = {
  readonly name: string;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly samples: number;
};

const nanosToMs = (nanos: number): number => nanos / 1_000_000;

/** Runs `operation` in batches so each sample is long enough to time reliably. */
export const measure = (
  name: string,
  operation: () => void,
  options: { readonly samples?: number; readonly batch?: number; readonly warmup?: number } = {},
): Measurement => {
  const samples = options.samples ?? 60;
  const batch = options.batch ?? 20;
  for (let i = 0; i < (options.warmup ?? 200); i++) operation();
  const perOperation: Array<number> = [];
  for (let sample = 0; sample < samples; sample++) {
    const start = Bun.nanoseconds();
    for (let i = 0; i < batch; i++) operation();
    perOperation.push((Bun.nanoseconds() - start) / batch);
  }
  perOperation.sort((a, b) => a - b);
  return {
    name,
    medianMs: nanosToMs(perOperation[Math.floor(samples / 2)] ?? 0),
    p95Ms: nanosToMs(perOperation[Math.floor(samples * 0.95)] ?? 0),
    samples,
  };
};

/** Heap growth in bytes per call after warm-up, with a full GC before and after. */
export const heapGrowthPerCall = (operation: () => void, calls: number): number => {
  for (let i = 0; i < 1000; i++) operation();
  Bun.gc(true);
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < calls; i++) operation();
  const after = process.memoryUsage().heapUsed;
  Bun.gc(true);
  return (after - before) / calls;
};
