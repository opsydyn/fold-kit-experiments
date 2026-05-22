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

// DIVERGING COLOUR SCALE — D3 scaleDiverging parity (d3-scale/src/diverging.js)
// Domain has 3 values: [min, pivot, max]. Pivot maps to t=0.5.

export type DivergingScaleConfig = Readonly<{
  /** Three-value domain: [min, pivot, max] */
  domain: readonly [number, number, number];
  interpolator: (t: number) => string;
  clamp?: boolean;
}>;

export function divergingScale(config: DivergingScaleConfig): (value: number) => string {
  const [d0, d1, d2] = config.domain;
  const clamp = config.clamp ?? true;
  const interpolator = config.interpolator;

  return (value: number): string => {
    let t: number;
    if (value <= d1) {
      const span = d1 - d0;
      t = span === 0 ? 0 : ((value - d0) / span) * 0.5;
    } else {
      const span = d2 - d1;
      t = span === 0 ? 1 : 0.5 + ((value - d1) / span) * 0.5;
    }
    if (clamp) t = Math.max(0, Math.min(1, t));
    return interpolator(t);
  };
}

// HSL COLOR SPACE — hue-saturation-lightness interpolation
// Shortest-path hue traversal (D3 d3-color parity)

function hexToHsl(hex: string): readonly [number, number, number] {
  const [r, g, b] = parseHex(hex);
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = d / (l > 0.5 ? 2 - max - min : max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): readonly [number, number, number] {
  const hNorm = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hNorm) * 255),
    Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  ];
}

export function interpolateHsl(c0: string, c1: string): (t: number) => string {
  const [h0, s0, l0] = hexToHsl(c0);
  const [h1, s1, l1] = hexToHsl(c1);
  let dh = h1 - h0;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return (t: number): string => {
    const [r, g, b] = hslToRgb(h0 + dh * t, s0 + (s1 - s0) * t, l0 + (l1 - l0) * t);
    return `rgb(${r},${g},${b})`;
  };
}

// LAB COLOR SPACE — CIELAB perceptual interpolation
// D3 d3-color parity — D65 white point constants from d3-color/src/lab.js
const Xn = 0.96422,
  Yn = 1,
  Zn = 0.82521;
const t0Lab = 4 / 29,
  t1Lab = 6 / 29,
  t2Lab = 3 * t1Lab * t1Lab,
  t3Lab = t1Lab ** 3;

function labF(t: number): number {
  return t > t3Lab ? Math.cbrt(t) : t / t2Lab + t0Lab;
}
function labFInv(t: number): number {
  return t > t1Lab ? t ** 3 : t2Lab * (t - t0Lab);
}

function srgbExpand(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function srgbCompress(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function hexToLab(hex: string): readonly [number, number, number] {
  const [r, g, b] = parseHex(hex);
  const rL = srgbExpand(r / 255),
    gL = srgbExpand(g / 255),
    bL = srgbExpand(b / 255);
  const x = labF((0.4360747 * rL + 0.3850649 * gL + 0.1430804 * bL) / Xn);
  const y = labF((0.2225045 * rL + 0.7168786 * gL + 0.0606169 * bL) / Yn);
  const z = labF((0.0139322 * rL + 0.0971045 * gL + 0.7141733 * bL) / Zn);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function labToRgbTriplet(L: number, a: number, b: number): readonly [number, number, number] {
  const y = (L + 16) / 116;
  const x = y + a / 500;
  const z = y - b / 200;
  const X = labFInv(x) * Xn,
    Y = labFInv(y) * Yn,
    Z = labFInv(z) * Zn;
  const r = srgbCompress(3.1338561 * X - 1.6168667 * Y - 0.4906146 * Z);
  const g = srgbCompress(-0.9787684 * X + 1.9161415 * Y + 0.033454 * Z);
  const bv = srgbCompress(0.0719453 * X - 0.2289914 * Y + 1.4052427 * Z);
  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(bv * 255))),
  ];
}

export function interpolateLab(c0: string, c1: string): (t: number) => string {
  const [L0, a0, b0] = hexToLab(c0);
  const [L1, a1, b1] = hexToLab(c1);
  return (t: number): string => {
    const [r, g, b] = labToRgbTriplet(
      L0 + (L1 - L0) * t,
      a0 + (a1 - a0) * t,
      b0 + (b1 - b0) * t,
    );
    return `rgb(${r},${g},${b})`;
  };
}
