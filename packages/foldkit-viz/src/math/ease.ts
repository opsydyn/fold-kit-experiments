// Easing functions — D3 d3-ease parity

export const easeLinear = (t: number): number => t;

// Cubic
export const easeCubicIn = (t: number): number => t * t * t;
export const easeCubicOut = (t: number): number => 1 - (1 - t) ** 3;
export const easeCubicInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

// Sin
export const easeSinIn = (t: number): number => 1 - Math.cos((t * Math.PI) / 2);
export const easeSinOut = (t: number): number => Math.sin((t * Math.PI) / 2);
export const easeSinInOut = (t: number): number => (1 - Math.cos(Math.PI * t)) / 2;

// Back (overshoot) — D3 default overshoot = 1.70158
const OVERSHOOT = 1.70158;
export const easeBackIn = (t: number): number =>
  t * t * ((OVERSHOOT + 1) * t - OVERSHOOT);
export const easeBackOut = (t: number): number =>
  1 + (t - 1) ** 2 * ((OVERSHOOT + 1) * (t - 1) + OVERSHOOT);
export const easeBackInOut = (t: number): number => {
  const s = OVERSHOOT * 1.525;
  return t < 0.5
    ? ((2 * t) ** 2 * ((s + 1) * 2 * t - s)) / 2
    : ((2 * t - 2) ** 2 * ((s + 1) * (2 * t - 2) + s) + 2) / 2;
};

// Bounce — from d3-ease/src/bounce.js
function bounceOut(t: number): number {
  const b1 = 4 / 11,
    b2 = 6 / 11,
    b3 = 8 / 11,
    b4 = 3 / 4,
    b5 = 9 / 11,
    b6 = 10 / 11,
    b7 = 15 / 16,
    b8 = 21 / 22,
    b9 = 63 / 64;
  const b0 = 1 / b1 / b1;
  if (t < b1) return b0 * t * t;
  if (t < b3) return b0 * (t -= b2) * t + b4;
  if (t < b6) return b0 * (t -= b5) * t + b7;
  return b0 * (t -= b8) * t + b9;
}
export const easeBounceOut = bounceOut;
export const easeBounceIn = (t: number): number => 1 - bounceOut(1 - t);
export const easeBounceInOut = (t: number): number =>
  t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2;

// Elastic out — D3 default amplitude=1, period=0.3 (d3-ease/src/elastic.js)
function tpmt(x: number): number {
  return (Math.pow(2, -10 * x) - 0.0009765625) * 1.0009775171065494;
}
const ELASTIC_PERIOD = 0.3;
export const easeElasticOut = (t: number): number => {
  if (t === 0 || t === 1) return t;
  const p = ELASTIC_PERIOD;
  return (
    tpmt(t) *
      Math.sin(
        ((t - (p / (2 * Math.PI)) * Math.asin(1)) * (2 * Math.PI)) / p,
      ) +
    1
  );
};
export const easeElasticIn = (t: number): number => 1 - easeElasticOut(1 - t);
export const easeElasticInOut = (t: number): number =>
  t < 0.5 ? (1 - easeElasticOut(1 - 2 * t)) / 2 : (1 + easeElasticOut(2 * t - 1)) / 2;
