import type { PathBuilder } from './path';
import { path as makePath } from './path';

// D3 parity: epsilon from d3-shape/src/math.js
const epsilon = 1e-12;

interface Curve {
  lineStart(): void;
  lineEnd(): void;
  point(x: number, y: number): void;
}

// ---- Linear (d3-shape/src/curve/linear.js) ----------------------------------

class LinearCurve implements Curve {
  private _point = 0;
  constructor(private readonly _ctx: PathBuilder) {}
  lineStart() {
    this._point = 0;
  }
  lineEnd() {}
  point(x: number, y: number) {
    x = +x;
    y = +y;
    if (this._point === 0) {
      this._point = 1;
      this._ctx.moveTo(x, y);
    } else {
      this._ctx.lineTo(x, y);
    }
  }
}

// ---- CatmullRom (d3-shape/src/curve/catmullRom.js, alpha=0.5 centripetal) --

class CatmullRomCurve implements Curve {
  private _x0 = NaN;
  private _y0 = NaN;
  private _x1 = NaN;
  private _y1 = NaN;
  private _x2 = NaN;
  private _y2 = NaN;
  private _l01_a = 0;
  private _l12_a = 0;
  private _l23_a = 0;
  private _l01_2a = 0;
  private _l12_2a = 0;
  private _l23_2a = 0;
  private _point = 0;

  constructor(
    private readonly _ctx: PathBuilder,
    private readonly _alpha: number,
  ) {}

  lineStart() {
    this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
    this._l01_a =
      this._l12_a =
      this._l23_a =
      this._l01_2a =
      this._l12_2a =
      this._l23_2a =
      this._point =
        0;
  }

  lineEnd() {
    if (this._point === 2) this._ctx.lineTo(this._x2, this._y2);
    else if (this._point === 3) this.point(this._x2, this._y2);
  }

  point(x: number, y: number) {
    x = +x;
    y = +y;
    if (this._point) {
      const x23 = this._x2 - x;
      const y23 = this._y2 - y;
      this._l23_2a = (x23 * x23 + y23 * y23) ** this._alpha;
      this._l23_a = Math.sqrt(this._l23_2a);
    }

    if (this._point >= 2) {
      if (this._point === 2) this._point = 3;
      let cx1 = this._x1;
      let cy1 = this._y1;
      let cx2 = this._x2;
      let cy2 = this._y2;
      if (this._l01_a > epsilon) {
        const a = 2 * this._l01_2a + 3 * this._l01_a * this._l12_a + this._l12_2a;
        const n = 3 * this._l01_a * (this._l01_a + this._l12_a);
        cx1 = (cx1 * a - this._x0 * this._l12_2a + this._x2 * this._l01_2a) / n;
        cy1 = (cy1 * a - this._y0 * this._l12_2a + this._y2 * this._l01_2a) / n;
      }
      if (this._l23_a > epsilon) {
        const b = 2 * this._l23_2a + 3 * this._l23_a * this._l12_a + this._l12_2a;
        const m = 3 * this._l23_a * (this._l23_a + this._l12_a);
        cx2 = (cx2 * b + this._x1 * this._l23_2a - x * this._l12_2a) / m;
        cy2 = (cy2 * b + this._y1 * this._l23_2a - y * this._l12_2a) / m;
      }
      this._ctx.bezierCurveTo(cx1, cy1, cx2, cy2, this._x2, this._y2);
    } else if (this._point === 0) {
      this._point = 1;
      this._ctx.moveTo(x, y);
    } else {
      this._point = 2;
    }

    this._l01_a = this._l12_a;
    this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a;
    this._l12_2a = this._l23_2a;
    this._x0 = this._x1;
    this._x1 = this._x2;
    this._x2 = x;
    this._y0 = this._y1;
    this._y1 = this._y2;
    this._y2 = y;
  }
}

// ---- MonotoneX (d3-shape/src/curve/monotone.js, Steffen 1990) --------------

function msign(x: number): -1 | 1 {
  return x < 0 ? -1 : 1;
}

// Faithful port of D3's slope3: handles zero-width segments via signed zero
function mslope3(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): number {
  const h0 = x1 - x0;
  const h1 = x2 - x1;
  const d0 = h0 !== 0 ? h0 : h1 < 0 ? -0 : 0;
  const d1 = h1 !== 0 ? h1 : h0 < 0 ? -0 : 0;
  const s0 = (y1 - y0) / d0;
  const s1 = (y2 - y1) / d1;
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (msign(s0) + msign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

function mslope2(x0: number, y0: number, x1: number, y1: number, t: number): number {
  const h = x1 - x0;
  return h ? (3 * (y1 - y0)) / h / 2 - t / 2 : t;
}

function monotoneSegment(
  ctx: PathBuilder,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t0: number,
  t1: number,
) {
  const dx = (x1 - x0) / 3;
  ctx.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
}

class MonotoneXCurve implements Curve {
  private _x0 = NaN;
  private _y0 = NaN;
  private _x1 = NaN;
  private _y1 = NaN;
  private _t0 = NaN;
  private _point = 0;

  constructor(private readonly _ctx: PathBuilder) {}

  lineStart() {
    this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN;
    this._point = 0;
  }

  lineEnd() {
    if (this._point === 2) {
      this._ctx.lineTo(this._x1, this._y1);
    } else if (this._point === 3) {
      monotoneSegment(
        this._ctx,
        this._x0,
        this._y0,
        this._x1,
        this._y1,
        this._t0,
        mslope2(this._x0, this._y0, this._x1, this._y1, this._t0),
      );
    }
  }

  point(x: number, y: number) {
    x = +x;
    y = +y;
    if (x === this._x1 && y === this._y1) return;
    let t1 = NaN;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._ctx.moveTo(x, y);
        break;
      case 1:
        this._point = 2;
        break;
      case 2: {
        this._point = 3;
        t1 = mslope3(this._x0, this._y0, this._x1, this._y1, x, y);
        monotoneSegment(
          this._ctx,
          this._x0,
          this._y0,
          this._x1,
          this._y1,
          mslope2(this._x0, this._y0, this._x1, this._y1, t1),
          t1,
        );
        break;
      }
      default: {
        t1 = mslope3(this._x0, this._y0, this._x1, this._y1, x, y);
        monotoneSegment(this._ctx, this._x0, this._y0, this._x1, this._y1, this._t0, t1);
        break;
      }
    }
    this._x0 = this._x1;
    this._x1 = x;
    this._y0 = this._y1;
    this._y1 = y;
    this._t0 = t1;
  }
}

// ---- Public API (d3-shape/src/line.js pattern) ------------------------------

export type CurveType = 'linear' | 'catmullRom' | 'monotoneX';

export interface LineConfig {
  readonly curve?: CurveType;
  /** CatmullRom parameterisation: 0=uniform, 0.5=centripetal (default), 1=chordal */
  readonly alpha?: number;
  readonly defined?: (point: readonly [number, number], index: number) => boolean;
  readonly digits?: number;
}

export function line(
  points: ReadonlyArray<readonly [number, number]>,
  config: LineConfig = {},
): string | null {
  const { curve: curveType = 'linear', alpha = 0.5, defined, digits } = config;

  const buf = makePath(digits);
  const curveObj: Curve =
    curveType === 'catmullRom'
      ? new CatmullRomCurve(buf, alpha)
      : curveType === 'monotoneX'
        ? new MonotoneXCurve(buf)
        : new LinearCurve(buf);

  const n = points.length;
  let inSegment = false;

  for (let i = 0; i <= n; i++) {
    const point = points[i];
    const isDefined = point !== undefined && (defined ? defined(point, i) : true);

    if (isDefined !== inSegment) {
      inSegment = isDefined;
      if (inSegment) curveObj.lineStart();
      else curveObj.lineEnd();
    }
    if (inSegment && point !== undefined) curveObj.point(point[0], point[1]);
  }

  const result = buf.toString();
  return result === '' ? null : result;
}
