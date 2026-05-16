// LINEAR SCALE

export type LinearScaleConfig = Readonly<{
  domain: readonly [number, number];
  range: readonly [number, number];
  clamp?: boolean;
}>;

export function linear(config: LinearScaleConfig): (value: number) => number {
  const [d0, d1] = config.domain;
  const [r0, r1] = config.range;
  const clamp = config.clamp ?? false;
  const k = (r1 - r0) / (d1 - d0);

  return (value: number): number => {
    let t = (value - d0) * k + r0;
    if (clamp) t = r1 > r0 ? Math.max(r0, Math.min(r1, t)) : Math.max(r1, Math.min(r0, t));
    return t;
  };
}

function tickStep(start: number, stop: number, count: number): number {
  const step0 = Math.abs(stop - start) / Math.max(0, count);
  let step1 = 10 ** Math.floor(Math.log(step0) / Math.LN10);
  const error = step0 / step1;
  if (error >= Math.SQRT2 * Math.sqrt(5)) step1 *= 10;
  else if (error >= Math.sqrt(10)) step1 *= 5;
  else if (error >= Math.SQRT2) step1 *= 2;
  return stop < start ? -step1 : step1;
}

export function linearTicks(
  domain: readonly [number, number],
  count = 5,
): ReadonlyArray<number> {
  const [start, stop] = domain;
  const step = tickStep(start, stop, count);
  if (!isFinite(step) || step === 0) return [];
  const t0 = Math.ceil(start / step) * step;
  const t1 = Math.floor(stop / step) * step;
  const n = Math.round((t1 - t0) / step) + 1;
  return Array.from({ length: n }, (_, i) => parseFloat((t0 + i * step).toPrecision(12)));
}

// BAND SCALE

export type BandScaleConfig = Readonly<{
  domain: ReadonlyArray<string>;
  range: readonly [number, number];
  paddingInner?: number;
  paddingOuter?: number;
}>;

export type BandScale = Readonly<{
  position: (value: string) => number;
  bandwidth: number;
  step: number;
  domain: ReadonlyArray<string>;
}>;

export function band(config: BandScaleConfig): BandScale {
  const { domain, range: [r0, r1], paddingInner = 0.1, paddingOuter = 0.1 } = config;
  const n = domain.length;
  const step = (r1 - r0) / Math.max(1, n - paddingInner + paddingOuter * 2);
  const bandwidth = step * (1 - paddingInner);
  const start = r0 + paddingOuter * step;
  const index = new Map(domain.map((d, i) => [d, i]));

  return {
    position: (value: string): number => start + (index.get(value) ?? 0) * step,
    bandwidth,
    step,
    domain,
  };
}
