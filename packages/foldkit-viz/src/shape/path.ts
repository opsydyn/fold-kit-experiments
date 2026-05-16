const tau = 2 * Math.PI;
const epsilon = 1e-6;
const tauEpsilon = tau - epsilon;

export interface PathBuilder {
  moveTo(x: number, y: number): void;
  closePath(): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(
    cpx1: number,
    cpy1: number,
    cpx2: number,
    cpy2: number,
    x: number,
    y: number,
  ): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  rect(x: number, y: number, w: number, h: number): void;
  toString(): string;
}

export function path(digits?: number): PathBuilder {
  const r =
    digits == null
      ? (n: number) => n
      : (n: number) => Math.round(n * 10 ** digits) / 10 ** digits;

  // current point
  let x1 = NaN;
  let y1 = NaN;
  // start of current subpath
  let x0 = NaN;
  let y0 = NaN;
  const parts: string[] = [];

  return {
    moveTo(x, y) {
      parts.push(`M${r((x0 = x1 = x))},${r((y0 = y1 = y))}`);
    },

    closePath() {
      if (!isNaN(x1)) {
        x1 = x0;
        y1 = y0;
        parts.push('Z');
      }
    },

    lineTo(x, y) {
      parts.push(`L${r((x1 = x))},${r((y1 = y))}`);
    },

    quadraticCurveTo(cpx, cpy, x, y) {
      parts.push(`Q${r(cpx)},${r(cpy)},${r((x1 = x))},${r((y1 = y))}`);
    },

    bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x, y) {
      parts.push(
        `C${r(cpx1)},${r(cpy1)},${r(cpx2)},${r(cpy2)},${r((x1 = x))},${r((y1 = y))}`,
      );
    },

    arcTo(ax1, ay1, ax2, ay2, radius) {
      const ax0 = x1;
      const ay0 = y1;
      const x21 = ax2 - ax1;
      const y21 = ay2 - ay1;
      const x01 = ax0 - ax1;
      const y01 = ay0 - ay1;
      const l01sq = x01 * x01 + y01 * y01;

      if (radius < 0) throw new Error(`negative radius: ${radius}`);

      // no current point — treat as moveTo
      if (isNaN(x1)) {
        parts.push(`M${r((x1 = ax1))},${r((y1 = ay1))}`);
      } else if (l01sq > epsilon) {
        const l21sq = x21 * x21 + y21 * y21;
        const l01 = Math.sqrt(l01sq);
        const l21 = Math.sqrt(l21sq);
        const dot = x01 * x21 + y01 * y21;
        const cross = x01 * y21 - y01 * x21;
        // handle collinear or zero-radius
        if (l21sq < epsilon || Math.abs(cross) < epsilon || radius === 0) {
          parts.push(`L${r((x1 = ax1))},${r((y1 = ay1))}`);
        } else {
          const t01 = (radius * l21sq - dot * Math.sqrt(l01sq * l21sq)) / (cross * l21);
          const t21 = (radius * l01sq - dot * Math.sqrt(l01sq * l21sq)) / (cross * l01);
          const q01x = ax1 + t01 * x01;
          const q01y = ay1 + t01 * y01;
          const q21x = ax1 + t21 * x21;
          const q21y = ay1 + t21 * y21;
          const cw = cross < 0 ? 0 : 1;
          parts.push(
            `L${r(q01x)},${r(q01y)}` +
              `A${r(radius)},${r(radius)},0,0,${cw},${r((x1 = q21x))},${r((y1 = q21y))}`,
          );
        }
      }
    },

    arc(x, y, radius, a0, a1, ccw = false) {
      const dx = radius * Math.cos(a0);
      const dy = radius * Math.sin(a0);
      const sx = x + dx;
      const sy = y + dy;
      const cw = ccw ? 0 : 1;
      let da = ccw ? a0 - a1 : a1 - a0;

      if (radius < 0) throw new Error(`negative radius: ${radius}`);

      if (isNaN(x1)) {
        parts.push(`M${r(sx)},${r(sy)}`);
      } else if (Math.abs(x1 - sx) > epsilon || Math.abs(y1 - sy) > epsilon) {
        parts.push(`L${r(sx)},${r(sy)}`);
      }

      if (!radius) return;

      if (da < 0) da = (da % tau) + tau;

      if (da > tauEpsilon) {
        // full circle — two half-arcs to avoid degenerate SVG arc
        parts.push(
          `A${r(radius)},${r(radius)},0,1,${cw},${r(x - dx)},${r(y - dy)}` +
            `A${r(radius)},${r(radius)},0,1,${cw},${r((x1 = sx))},${r((y1 = sy))}`,
        );
      } else if (da > epsilon) {
        parts.push(
          `A${r(radius)},${r(radius)},0,${da >= Math.PI ? 1 : 0},${cw},${r((x1 = x + radius * Math.cos(a1)))},${r((y1 = y + radius * Math.sin(a1)))}`,
        );
      }
    },

    rect(x, y, w, h) {
      x0 = x1 = x;
      y0 = y1 = y;
      parts.push(`M${r(x)},${r(y)}h${r(w)}v${r(h)}h${r(-w)}Z`);
    },

    toString() {
      return parts.join('');
    },
  };
}
