// Symbol path generators — ported from d3-shape/src/symbol/*.js
// Each symbol is centered at the origin; use an SVG transform to position it.
// Size is approximate area in square pixels, matching D3's convention.

const SQRT3 = Math.sqrt(3);

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Types

export type SymbolType =
  | 'circle'
  | 'cross'
  | 'diamond'
  | 'square'
  | 'star'
  | 'triangle'
  | 'wye';

/** Ordered set of fill-optimised symbols matching D3's symbolsFill. */
export const SYMBOLS_FILL: ReadonlyArray<SymbolType> = [
  'circle',
  'cross',
  'diamond',
  'square',
  'star',
  'triangle',
  'wye',
];

// ---------------------------------------------------------------------------
// Per-symbol path builders

function circlePath(size: number): string {
  const r = r3(Math.sqrt(size / Math.PI));
  return `M${r},0A${r},${r},0,1,1,-${r},0A${r},${r},0,1,1,${r},0`;
}

function crossPath(size: number): string {
  // Greek cross — arm length 3r, arm width 2r → area = 5 × (2r)² = 20r²
  const r = r3(Math.sqrt(size / 5) / 2);
  const r3r = r3(3 * Math.sqrt(size / 5) / 2);
  return `M${-r3r},${-r}H${-r}V${-r3r}H${r}V${-r}H${r3r}V${r}H${r}V${r3r}H${-r}V${r}H${-r3r}Z`;
}

function diamondPath(size: number): string {
  // Rhombus with aspect ratio tan(60°) — matches d3-shape/diamond
  const tan60 = Math.tan(Math.PI / 3);
  const y = r3(Math.sqrt(size / (tan60 * 2)));
  const x = r3(y * tan60);
  return `M0,${-y}L${x},0L0,${y}L${-x},0Z`;
}

function squarePath(size: number): string {
  const r = r3(Math.sqrt(size) / 2);
  return `M${-r},${-r}H${r}V${r}H${-r}Z`;
}

function starPath(size: number): string {
  // 5-pointed pentagram — D3 constants for exact area
  const ka = 0.8908130915292852;
  const kr = Math.sin(Math.PI / 10) / Math.sin((7 * Math.PI) / 10);
  const outerR = Math.sqrt(size * ka);
  const innerR = kr * outerR;

  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? outerR : innerR;
    pts.push(`${i === 0 ? 'M' : 'L'}${r3(radius * Math.cos(angle))},${r3(radius * Math.sin(angle))}`);
  }
  return pts.join('') + 'Z';
}

function trianglePath(size: number): string {
  // Up-pointing equilateral triangle — area = 3√3 × y²
  const y = r3(Math.sqrt(size / (SQRT3 * 3)));
  const x = r3(SQRT3 * y);
  return `M0,${r3(-2 * y)}L${x},${y}L${-x},${y}Z`;
}

function wyePath(size: number): string {
  // Y-shape — matches d3-shape/wye constants
  const c = -0.5;
  const s = SQRT3 / 2;
  const k = 1 / Math.sqrt(12);
  const a = (k / 2 + 1) * 3;
  const r = Math.sqrt(size / a);
  const r1 = r3(r * k);
  const r2 = r3(r * (k / 2 + 1));
  const cx = r3(c * r);
  const sx = r3(s * r);
  const cx2 = r3(c * r * (k / 2 + 1));
  const sx2 = r3(s * r * (k / 2 + 1));
  return `M${-r1},${r2}L${r1},${r2}L${r1},${r3(r * k)}L${sx2},${cx2}L${sx},${cx}L${r1},${r3(-r * k)}L${-r1},${r3(-r * k)}L${-sx},${cx}L${-sx2},${cx2}L${-r1},${r3(r * k)}Z`;
}

// ---------------------------------------------------------------------------
// Public API

/**
 * Returns an SVG path `d` string for the given symbol type and size.
 * The path is centered at the origin — use `transform="translate(x,y)"`.
 *
 * @param type - One of the SYMBOLS_FILL types.
 * @param size - Approximate area in square pixels (default 64, matching D3).
 */
export function symbolPath(type: SymbolType, size = 64): string {
  switch (type) {
    case 'circle':
      return circlePath(size);
    case 'cross':
      return crossPath(size);
    case 'diamond':
      return diamondPath(size);
    case 'square':
      return squarePath(size);
    case 'star':
      return starPath(size);
    case 'triangle':
      return trianglePath(size);
    case 'wye':
      return wyePath(size);
  }
}
