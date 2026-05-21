// RGB color interpolation — parity with d3-interpolate interpolateRgb / interpolateRgbBasis

function parseHex(hex: string): readonly [number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ] as const;
}

export function interpolateRgb(c0: string, c1: string): (t: number) => string {
  const [r0, g0, b0] = parseHex(c0);
  const [r1, g1, b1] = parseHex(c1);
  return (t: number): string => {
    const r = Math.round(r0 + (r1 - r0) * t);
    const g = Math.round(g0 + (g1 - g0) * t);
    const b = Math.round(b0 + (b1 - b0) * t);
    return `rgb(${r},${g},${b})`;
  };
}

export function interpolateRgbBasis(colors: ReadonlyArray<string>): (t: number) => string {
  if (colors.length === 0) return () => 'rgb(0,0,0)';
  if (colors.length === 1) return () => colors[0] ?? 'rgb(0,0,0)';
  const n = colors.length - 1;
  const interps = Array.from({ length: n }, (_, i) =>
    interpolateRgb(colors[i] ?? '#000000', colors[i + 1] ?? '#ffffff'),
  );
  return (t: number): string => {
    const clamped = Math.max(0, Math.min(1, t));
    const segment = Math.min(Math.floor(clamped * n), n - 1);
    const localT = clamped * n - segment;
    return (interps[segment] ?? interps[0] ?? (() => 'rgb(0,0,0)'))(localT);
  };
}

export type ColorScaleConfig = Readonly<{
  domain: readonly [number, number];
  interpolator: (t: number) => string;
  clamp?: boolean;
}>;

export function colorScale(config: ColorScaleConfig): (value: number) => string {
  const [d0, d1] = config.domain;
  const span = d1 - d0;
  const clamp = config.clamp ?? true;
  return (value: number): string => {
    let t = span === 0 ? 0 : (value - d0) / span;
    if (clamp) t = Math.max(0, Math.min(1, t));
    return config.interpolator(t);
  };
}
