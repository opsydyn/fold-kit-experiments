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

// ---- Basis (d3-shape/src/curve/basis.js) ------------------------------------

function basisSegment(
  ctx: PathBuilder,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number,
  y: number,
) {
  ctx.bezierCurveTo(
    (2 * x0 + x1) / 3,
    (2 * y0 + y1) / 3,
    (x0 + 2 * x1) / 3,
    (y0 + 2 * y1) / 3,
    (x0 + 4 * x1 + x) / 6,
    (y0 + 4 * y1 + y) / 6,
  );
}

class BasisCurve implements Curve {
  private _x0 = NaN;
  private _y0 = NaN;
  private _x1 = NaN;
  private _y1 = NaN;
  private _point = 0;
  constructor(private readonly _ctx: PathBuilder) {}
  lineStart() {
    this._x0 = this._x1 = this._y0 = this._y1 = NaN;
    this._point = 0;
  }
  lineEnd() {
    if (this._point === 3) {
      basisSegment(this._ctx, this._x0, this._y0, this._x1, this._y1, this._x1, this._y1);
      this._ctx.lineTo(this._x1, this._y1);
    } else if (this._point === 2) {
      this._ctx.lineTo(this._x1, this._y1);
    }
  }
  point(x: number, y: number) {
    x = +x;
    y = +y;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._ctx.moveTo(x, y);
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
        this._ctx.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6);
        basisSegment(this._ctx, this._x0, this._y0, this._x1, this._y1, x, y);
        break;
      default:
        basisSegment(this._ctx, this._x0, this._y0, this._x1, this._y1, x, y);
    }
    this._x0 = this._x1;
    this._x1 = x;
    this._y0 = this._y1;
    this._y1 = y;
  }
}

// ---- Cardinal (d3-shape/src/curve/cardinal.js) ------------------------------

function cardinalSegment(
  ctx: PathBuilder,
  k: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number,
) {
  ctx.bezierCurveTo(
    x1 + k * (x2 - x0),
    y1 + k * (y2 - y0),
    x2 + k * (x1 - x),
    y2 + k * (y1 - y),
    x2,
    y2,
  );
}

class CardinalCurve implements Curve {
  private _x0 = NaN;
  private _y0 = NaN;
  private _x1 = NaN;
  private _y1 = NaN;
  private _x2 = NaN;
  private _y2 = NaN;
  private _point = 0;
  private readonly _k: number;
  constructor(
    private readonly _ctx: PathBuilder,
    tension = 0,
  ) {
    this._k = (1 - tension) / 6;
  }
  lineStart() {
    this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
    this._point = 0;
  }
  lineEnd() {
    if (this._point === 2) this._ctx.lineTo(this._x2, this._y2);
    else if (this._point === 3)
      cardinalSegment(
        this._ctx,
        this._k,
        this._x0,
        this._y0,
        this._x1,
        this._y1,
        this._x2,
        this._y2,
        this._x1,
        this._y1,
      );
  }
  point(x: number, y: number) {
    x = +x;
    y = +y;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._ctx.moveTo(x, y);
        break;
      case 1:
        this._point = 2;
        this._x1 = x;
        this._y1 = y;
        break;
      case 2:
        this._point = 3;
        cardinalSegment(
          this._ctx,
          this._k,
          this._x0,
          this._y0,
          this._x1,
          this._y1,
          this._x2,
          this._y2,
          x,
          y,
        );
        break;
      default:
        cardinalSegment(
          this._ctx,
          this._k,
          this._x0,
          this._y0,
          this._x1,
          this._y1,
          this._x2,
          this._y2,
          x,
          y,
        );
    }
    this._x0 = this._x1;
    this._x1 = this._x2;
    this._x2 = x;
    this._y0 = this._y1;
    this._y1 = this._y2;
    this._y2 = y;
  }
}

// ---- BasisOpen (d3-shape/src/curve/basisOpen.js) ----------------------------

class BasisOpenCurve implements Curve {
  private _x0 = NaN;
  private _y0 = NaN;
  private _x1 = NaN;
  private _y1 = NaN;
  private _point = 0;
  constructor(private readonly _ctx: PathBuilder) {}
  lineStart() {
    this._x0 = this._x1 = this._y0 = this._y1 = NaN;
    this._point = 0;
  }
  lineEnd() {}
  point(x: number, y: number) {
    x = +x;
    y = +y;
    switch (this._point) {
      case 0:
        this._point = 1;
        break;
      case 1:
        this._point = 2;
        break;
      case 2:
        this._point = 3;
        this._ctx.moveTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6);
        basisSegment(this._ctx, this._x0, this._y0, this._x1, this._y1, x, y);
        break;
      default:
        basisSegment(this._ctx, this._x0, this._y0, this._x1, this._y1, x, y);
    }
    this._x0 = this._x1;
    this._x1 = x;
    this._y0 = this._y1;
    this._y1 = y;
  }
}

// ---- BasisClosed (d3-shape/src/curve/basisClosed.js) ------------------------

class BasisClosedCurve implements Curve {
  private _x0 = NaN;
  private _y0 = NaN;
  private _x1 = NaN;
  private _y1 = NaN;
  private _x2 = NaN;
  private _y2 = NaN;
  private _x3 = NaN;
  private _y3 = NaN;
  private _x4 = NaN;
  private _y4 = NaN;
  private _point = 0;
  constructor(private readonly _ctx: PathBuilder) {}
  lineStart() {
    this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = NaN;
    this._point = 0;
  }
  lineEnd() {
    if (this._point > 1) {
      basisSegment(this._ctx, this._x2, this._y2, this._x3, this._y3, this._x4, this._y4);
      basisSegment(this._ctx, this._x3, this._y3, this._x4, this._y4, this._x0, this._y0);
      basisSegment(this._ctx, this._x4, this._y4, this._x0, this._y0, this._x1, this._y1);
      this._ctx.closePath();
    }
  }
  point(x: number, y: number) {
    x = +x;
    y = +y;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._x2 = x;
        this._y2 = y;
        break;
      case 1:
        this._point = 2;
        this._x3 = x;
        this._y3 = y;
        break;
      case 2:
        this._point = 3;
        this._x4 = x;
        this._y4 = y;
        this._ctx.moveTo((this._x0 + 4 * this._x1 + x) / 6, (this._y0 + 4 * this._y1 + y) / 6);
        basisSegment(this._ctx, this._x0, this._y0, this._x1, this._y1, x, y);
        break;
      default:
        basisSegment(this._ctx, this._x0, this._y0, this._x1, this._y1, x, y);
    }
    this._x0 = this._x1;
    this._x1 = x;
    this._y0 = this._y1;
    this._y1 = y;
  }
}

// ---- CardinalOpen / CardinalClosed ------------------------------------------

class CardinalOpenCurve implements Curve {
  private _x0 = NaN;
  private _y0 = NaN;
  private _x1 = NaN;
  private _y1 = NaN;
  private _x2 = NaN;
  private _y2 = NaN;
  private _point = 0;
  private readonly _k: number;
  constructor(
    private readonly _ctx: PathBuilder,
    tension = 0,
  ) {
    this._k = (1 - tension) / 6;
  }
  lineStart() {
    this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
    this._point = 0;
  }
  lineEnd() {}
  point(x: number, y: number) {
    x = +x;
    y = +y;
    switch (this._point) {
      case 0:
        this._point = 1;
        break;
      case 1:
        this._point = 2;
        this._ctx.moveTo(x, y);
        break;
      case 2:
        this._point = 3;
        cardinalSegment(
          this._ctx,
          this._k,
          this._x0,
          this._y0,
          this._x1,
          this._y1,
          this._x2,
          this._y2,
          x,
          y,
        );
        break;
      default:
        cardinalSegment(
          this._ctx,
          this._k,
          this._x0,
          this._y0,
          this._x1,
          this._y1,
          this._x2,
          this._y2,
          x,
          y,
        );
    }
    this._x0 = this._x1;
    this._x1 = this._x2;
    this._x2 = x;
    this._y0 = this._y1;
    this._y1 = this._y2;
    this._y2 = y;
  }
}

class CardinalClosedCurve implements Curve {
  private _x0 = NaN;
  private _y0 = NaN;
  private _x1 = NaN;
  private _y1 = NaN;
  private _x2 = NaN;
  private _y2 = NaN;
  private _x3 = NaN;
  private _y3 = NaN;
  private _point = 0;
  private readonly _k: number;
  constructor(
    private readonly _ctx: PathBuilder,
    tension = 0,
  ) {
    this._k = (1 - tension) / 6;
  }
  lineStart() {
    this._x0 = this._x1 = this._x2 = this._x3 = NaN;
    this._point = 0;
  }
  lineEnd() {
    if (this._point > 1) {
      cardinalSegment(
        this._ctx,
        this._k,
        this._x2,
        this._y2,
        this._x3,
        this._y3,
        this._x0,
        this._y0,
        this._x1,
        this._y1,
      );
      cardinalSegment(
        this._ctx,
        this._k,
        this._x3,
        this._y3,
        this._x0,
        this._y0,
        this._x1,
        this._y1,
        this._x2,
        this._y2,
      );
      this._ctx.closePath();
    }
  }
  point(x: number, y: number) {
    x = +x;
    y = +y;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._x3 = x;
        this._y3 = y;
        break;
      case 1:
        this._point = 2;
        this._ctx.moveTo(x, y);
        break;
      case 2:
        this._point = 3;
        cardinalSegment(
          this._ctx,
          this._k,
          this._x0,
          this._y0,
          this._x1,
          this._y1,
          this._x2,
          this._y2,
          x,
          y,
        );
        break;
      default:
        cardinalSegment(
          this._ctx,
          this._k,
          this._x0,
          this._y0,
          this._x1,
          this._y1,
          this._x2,
          this._y2,
          x,
          y,
        );
    }
    this._x0 = this._x1;
    this._x1 = this._x2;
    this._x2 = x;
    this._y0 = this._y1;
    this._y1 = this._y2;
    this._y2 = y;
  }
}

// ---- CatmullRomOpen / CatmullRomClosed — composition to avoid private access --

class CatmullRomOpenCurve implements Curve {
  private readonly _inner: CatmullRomCurve;
  constructor(ctx: PathBuilder, alpha: number) {
    this._inner = new CatmullRomCurve(ctx, alpha);
  }
  lineStart() {
    this._inner.lineStart();
  }
  lineEnd() {} // suppress the end segment for open variant
  point(x: number, y: number) {
    this._inner.point(x, y);
  }
}

class CatmullRomClosedCurve implements Curve {
  private readonly _inner: CatmullRomCurve;
  private _pts: Array<readonly [number, number]> = [];
  constructor(ctx: PathBuilder, alpha: number) {
    this._inner = new CatmullRomCurve(ctx, alpha);
  }
  lineStart() {
    this._inner.lineStart();
    this._pts = [];
  }
  lineEnd() {
    // close by feeding first two points back through, then flush
    for (const [px, py] of this._pts.slice(0, 2)) this._inner.point(px, py);
    this._inner.lineEnd();
  }
  point(x: number, y: number) {
    this._pts.push([+x, +y]);
    this._inner.point(x, y);
  }
}

// ---- Step curves (d3-shape/src/curve/step.js) --------------------------------

type StepMode = 'mid' | 'before' | 'after';

class StepCurve implements Curve {
  private _x = NaN;
  private _y = NaN;
  private _point = 0;
  constructor(
    private readonly _ctx: PathBuilder,
    private readonly _mode: StepMode,
  ) {}
  lineStart() {
    this._x = this._y = NaN;
    this._point = 0;
  }
  lineEnd() {
    if (this._mode === 'before' && this._point === 2) this._ctx.lineTo(this._x, this._y);
  }
  point(x: number, y: number) {
    x = +x;
    y = +y;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._ctx.moveTo(x, y);
        break;
      case 1:
        this._point = 2;
        if (this._mode === 'before') {
          this._ctx.lineTo(this._x, y);
          this._ctx.lineTo(x, y);
        } else if (this._mode === 'after') {
          this._ctx.lineTo(x, this._y);
          this._ctx.lineTo(x, y);
        } /* mid */ else {
          const mx = (this._x + x) / 2;
          this._ctx.lineTo(mx, this._y);
          this._ctx.lineTo(mx, y);
          this._ctx.lineTo(x, y);
        }
        break;
      default:
        if (this._mode === 'before') {
          this._ctx.lineTo(this._x, y);
          this._ctx.lineTo(x, y);
        } else if (this._mode === 'after') {
          this._ctx.lineTo(x, this._y);
          this._ctx.lineTo(x, y);
        } else {
          const mx = (this._x + x) / 2;
          this._ctx.lineTo(mx, this._y);
          this._ctx.lineTo(mx, y);
          this._ctx.lineTo(x, y);
        }
    }
    this._x = x;
    this._y = y;
  }
}

// ---- Natural cubic spline (d3-shape/src/curve/natural.js) -------------------

class NaturalCurve implements Curve {
  private _pts: Array<readonly [number, number]> = [];
  constructor(private readonly _ctx: PathBuilder) {}
  lineStart() {
    this._pts = [];
  }
  lineEnd() {
    const pts = this._pts;
    const n = pts.length;
    if (n < 2) return;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    this._ctx.moveTo(xs[0] ?? 0, ys[0] ?? 0);
    if (n === 2) {
      this._ctx.lineTo(xs[1] ?? 0, ys[1] ?? 0);
      return;
    }
    const [px1, px2] = naturalP1P2(xs);
    const [py1, py2] = naturalP1P2(ys);
    for (let i = 0; i < n - 1; i++) {
      this._ctx.bezierCurveTo(
        px1[i] ?? 0,
        py1[i] ?? 0,
        px2[i] ?? 0,
        py2[i] ?? 0,
        xs[i + 1] ?? 0,
        ys[i + 1] ?? 0,
      );
    }
  }
  point(x: number, y: number) {
    this._pts.push([+x, +y]);
  }
}

/**
 * D3 natural.js algorithm — compute P1 and P2 bezier control points
 * for a natural cubic spline through `coords`.
 */
function naturalP1P2(coords: ReadonlyArray<number>): [number[], number[]] {
  const n = coords.length - 1;
  if (n <= 0) return [[], []];
  const m = new Array<number>(n).fill(0);
  const a = new Array<number>(n).fill(0);
  const b = new Array<number>(n).fill(0);
  a[0] = 0;
  b[0] = 2;
  m[0] = (coords[0] ?? 0) + 2 * (coords[1] ?? 0);
  for (let i = 1; i < n - 1; i++) {
    a[i] = 1;
    b[i] = 4;
    m[i] = 4 * (coords[i] ?? 0) + 2 * (coords[i + 1] ?? 0);
  }
  if (n > 1) {
    a[n - 1] = 2;
    b[n - 1] = 7;
    m[n - 1] = 8 * (coords[n - 1] ?? 0) + (coords[n] ?? 0);
  }
  // Forward sweep
  for (let i = 1; i < n; i++) {
    const c = (a[i] ?? 0) / (b[i - 1] ?? 1);
    b[i] = (b[i] ?? 0) - c;
    m[i] = (m[i] ?? 0) - c * (m[i - 1] ?? 0);
  }
  // Back substitution → p1
  const p1 = new Array<number>(n).fill(0);
  p1[n - 1] = (m[n - 1] ?? 0) / (b[n - 1] ?? 1);
  for (let i = n - 2; i >= 0; i--) {
    p1[i] = ((m[i] ?? 0) - (p1[i + 1] ?? 0)) / (b[i] ?? 1);
  }
  // Derive p2
  const p2 = new Array<number>(n).fill(0);
  for (let i = 0; i < n - 1; i++) {
    p2[i] = 2 * (coords[i + 1] ?? 0) - (p1[i + 1] ?? 0);
  }
  p2[n - 1] = ((coords[n] ?? 0) + (p1[n - 1] ?? 0)) / 2;
  return [p1, p2];
}

// ---- Public API (d3-shape/src/line.js pattern) ------------------------------

export type CurveType =
  | 'linear'
  | 'catmullRom'
  | 'catmullRomOpen'
  | 'catmullRomClosed'
  | 'monotoneX'
  | 'basis'
  | 'basisOpen'
  | 'basisClosed'
  | 'cardinal'
  | 'cardinalOpen'
  | 'cardinalClosed'
  | 'step'
  | 'stepBefore'
  | 'stepAfter'
  | 'natural';

export interface LineConfig {
  readonly curve?: CurveType;
  /** CatmullRom parameterisation: 0=uniform, 0.5=centripetal (default), 1=chordal */
  readonly alpha?: number;
  /** Cardinal tension: 0=default, 1=linear. Default 0. */
  readonly tension?: number;
  readonly defined?: (point: readonly [number, number], index: number) => boolean;
  readonly digits?: number;
}

export function line(
  points: ReadonlyArray<readonly [number, number]>,
  config: LineConfig = {},
): string | null {
  const { curve: curveType = 'linear', alpha = 0.5, tension = 0, defined, digits } = config;

  const buf = makePath(digits);
  let curveObj: Curve;
  switch (curveType) {
    case 'catmullRom':
      curveObj = new CatmullRomCurve(buf, alpha);
      break;
    case 'catmullRomOpen':
      curveObj = new CatmullRomOpenCurve(buf, alpha);
      break;
    case 'catmullRomClosed':
      curveObj = new CatmullRomClosedCurve(buf, alpha);
      break;
    case 'monotoneX':
      curveObj = new MonotoneXCurve(buf);
      break;
    case 'basis':
      curveObj = new BasisCurve(buf);
      break;
    case 'basisOpen':
      curveObj = new BasisOpenCurve(buf);
      break;
    case 'basisClosed':
      curveObj = new BasisClosedCurve(buf);
      break;
    case 'cardinal':
      curveObj = new CardinalCurve(buf, tension);
      break;
    case 'cardinalOpen':
      curveObj = new CardinalOpenCurve(buf, tension);
      break;
    case 'cardinalClosed':
      curveObj = new CardinalClosedCurve(buf, tension);
      break;
    case 'step':
      curveObj = new StepCurve(buf, 'mid');
      break;
    case 'stepBefore':
      curveObj = new StepCurve(buf, 'before');
      break;
    case 'stepAfter':
      curveObj = new StepCurve(buf, 'after');
      break;
    case 'natural':
      curveObj = new NaturalCurve(buf);
      break;
    default:
      curveObj = new LinearCurve(buf);
  }

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
