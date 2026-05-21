import { path } from './path';

const halfPi = Math.PI / 2;
const tau = 2 * Math.PI;
const epsilon = 1e-12;

function asin(x: number): number {
  return x >= 1 ? halfPi : x <= -1 ? -halfPi : Math.asin(x);
}

function _intersect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): [number, number] {
  const x10 = x1 - x0;
  const y10 = y1 - y0;
  const x32 = x3 - x2;
  const y32 = y3 - y2;
  const t = (x32 * (y0 - y2) - y32 * (x0 - x2)) / (y32 * x10 - x32 * y10);
  return [x0 + t * x10, y0 + t * y10];
}

type CornerTangents = Readonly<{
  cx: number;
  cy: number;
  x01: number;
  y01: number;
  x11: number;
  y11: number;
}>;

function cornerTangents(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r1: number,
  rc: number,
  cw: boolean,
): CornerTangents {
  const x01 = x0 - x1;
  const y01 = y0 - y1;
  const lo = (cw ? rc : -rc) / Math.sqrt(x01 * x01 + y01 * y01);
  const ox = lo * y01;
  const oy = -lo * x01;
  const x11 = x0 + ox;
  const y11 = y0 + oy;
  const x10 = x1 + ox;
  const y10 = y1 + oy;
  const x00 = (x11 + x10) / 2;
  const y00 = (y11 + y10) / 2;
  const dx = x10 - x11;
  const dy = y10 - y11;
  const d2 = dx * dx + dy * dy;
  const r = r1 - rc;
  const D = x11 * y10 - x10 * y11;
  const disc = Math.max(0, r * r * d2 - D * D);
  const d = (dy < 0 ? -1 : 1) * Math.sqrt(disc);
  const cx0 = (D * dy - dx * d) / d2;
  const cy0 = (-D * dx - dy * d) / d2;
  const cx1 = (D * dy + dx * d) / d2;
  const cy1 = (-D * dx + dy * d) / d2;
  const dx0 = cx0 - x00;
  const dy0 = cy0 - y00;
  const dx1 = cx1 - x00;
  const dy1 = cy1 - y00;
  const [cx, cy] = dx0 * dx0 + dy0 * dy0 > dx1 * dx1 + dy1 * dy1 ? [cx1, cy1] : [cx0, cy0];
  return {
    cx,
    cy,
    x01: -ox,
    y01: -oy,
    x11: cx * (r1 / r - 1),
    y11: cy * (r1 / r - 1),
  };
}

export type ArcConfig = Readonly<{
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  padAngle?: number;
  padRadius?: number;
  cornerRadius?: number;
}>;

export function arc(config: ArcConfig): string {
  const {
    innerRadius: ir,
    outerRadius: or,
    startAngle: sa,
    endAngle: ea,
    padAngle = 0,
    padRadius = Math.sqrt(ir * ir + or * or),
    cornerRadius = 0,
  } = config;

  const p = path(3);

  // angular span
  const a0 = sa - halfPi;
  const a1 = ea - halfPi;
  const da = Math.abs(a1 - a0);
  const cw = a1 > a0;

  // pad angle: shrink both sides
  const halfPad = Math.max(0, Math.min(Math.PI, padAngle) - epsilon) / 2;
  const halfDa = da / 2;

  // whether segments are too small for a pad or corner
  const rOuter = Math.max(0, or);
  const rInner = Math.max(0, ir);

  // clamp cornerRadius
  const rc = Math.min(Math.abs(rOuter - rInner) / 2, cornerRadius);

  // padded angles
  let ap = halfPad > epsilon ? halfPad : 0;
  if (halfPad > halfDa - epsilon) ap = halfDa;

  const sinAp = Math.sin(ap);
  const _cosAp = Math.cos(ap);

  // outer pad delta
  const roPad = ap > epsilon ? asin((padRadius * sinAp) / rOuter) : ap;
  // inner pad delta
  const riPad = rInner > epsilon && ap > epsilon ? asin((padRadius * sinAp) / rInner) : ap;

  // outer arc angles (after padding)
  const outerA0 = cw ? a0 + roPad : a0 - roPad;
  const outerA1 = cw ? a1 - roPad : a1 + roPad;

  // is the outer arc too small to draw?
  const outerDa = Math.abs(outerA1 - outerA0);
  if (rOuter <= epsilon) {
    // degenerate point
    p.moveTo(0, 0);
  } else if (da > tau - epsilon) {
    // full annulus
    p.moveTo(rOuter * Math.cos(a0), rOuter * Math.sin(a0));
    p.arc(0, 0, rOuter, a0, a1, !cw);
    if (rInner > epsilon) {
      p.moveTo(rInner * Math.cos(a1), rInner * Math.sin(a1));
      p.arc(0, 0, rInner, a1, a0, cw);
    }
  } else {
    // outer arc start/end points
    const x01 = rOuter * Math.cos(outerA0);
    const y01 = rOuter * Math.sin(outerA0);
    const x10 = rOuter * Math.cos(outerA1);
    const y10 = rOuter * Math.sin(outerA1);

    if (rc > epsilon) {
      // outer corner at start
      const t0 = cornerTangents(
        x01,
        y01,
        rOuter * Math.cos(a0),
        rOuter * Math.sin(a0),
        rOuter,
        rc,
        cw,
      );
      // outer corner at end
      const t1 = cornerTangents(
        x10,
        y10,
        rOuter * Math.cos(a1),
        rOuter * Math.sin(a1),
        rOuter,
        rc,
        !cw,
      );

      p.moveTo(t0.cx + t0.x01, t0.cy + t0.y01);

      // outer arc
      if (outerDa > epsilon) {
        if (rc < Math.abs(rOuter) * halfDa - epsilon) {
          p.arc(t0.cx, t0.cy, rc, Math.atan2(t0.y01, t0.x01), Math.atan2(t1.y01, t1.x01), !cw);
          p.arc(
            0,
            0,
            rOuter,
            Math.atan2(t0.cy + t0.y11, t0.cx + t0.x11),
            Math.atan2(t1.cy + t1.y11, t1.cx + t1.x11),
            !cw,
          );
          p.arc(t1.cx, t1.cy, rc, Math.atan2(t1.y11, t1.x11), Math.atan2(t1.y01, t1.x01), !cw);
        } else {
          const cx = (x01 + x10) / 2;
          const cy = (y01 + y10) / 2;
          const a = Math.atan2(cy, cx);
          const rc2 =
            Math.sqrt(rOuter * rOuter - (cx * cx + cy * cy)) /
            Math.cos(Math.atan2(Math.abs(y01 - cy), Math.abs(x01 - cx)));
          p.arc(cx, cy, rc2, a - Math.PI, a, !cw);
        }
      } else {
        p.arc(t0.cx, t0.cy, rc, Math.atan2(t0.y01, t0.x01), Math.atan2(t0.y11, t0.x11), !cw);
      }
    } else {
      p.moveTo(x01, y01);
      if (outerDa > epsilon) {
        p.arc(0, 0, rOuter, outerA0, outerA1, !cw);
      }
    }

    // inner arc (or line to centre)
    if (rInner <= epsilon) {
      p.lineTo(0, 0);
    } else {
      const innerA0 = cw ? a1 - riPad : a1 + riPad;
      const innerA1 = cw ? a0 + riPad : a0 - riPad;
      const innerDa = Math.abs(innerA1 - innerA0);

      const x11 = rInner * Math.cos(innerA0);
      const y11 = rInner * Math.sin(innerA0);
      const x00 = rInner * Math.cos(innerA1);
      const y00 = rInner * Math.sin(innerA1);

      if (rc > epsilon) {
        const t0 = cornerTangents(
          x11,
          y11,
          rInner * Math.cos(a1),
          rInner * Math.sin(a1),
          rInner,
          -rc,
          cw,
        );
        const t1 = cornerTangents(
          x00,
          y00,
          rInner * Math.cos(a0),
          rInner * Math.sin(a0),
          rInner,
          -rc,
          !cw,
        );

        p.lineTo(t0.cx + t0.x01, t0.cy + t0.y01);

        if (innerDa > epsilon) {
          if (rc < Math.abs(rInner) * halfDa - epsilon) {
            p.arc(t0.cx, t0.cy, rc, Math.atan2(t0.y01, t0.x01), Math.atan2(t1.y01, t1.x01), !cw);
            p.arc(
              0,
              0,
              rInner,
              Math.atan2(t0.cy + t0.y11, t0.cx + t0.x11),
              Math.atan2(t1.cy + t1.y11, t1.cx + t1.x11),
              cw,
            );
            p.arc(t1.cx, t1.cy, rc, Math.atan2(t1.y11, t1.x11), Math.atan2(t1.y01, t1.x01), !cw);
          } else {
            p.arc(t0.cx, t0.cy, rc, Math.atan2(t0.y01, t0.x01), Math.atan2(t0.y11, t0.x11), !cw);
          }
        } else {
          p.arc(t0.cx, t0.cy, rc, Math.atan2(t0.y01, t0.x01), Math.atan2(t0.y11, t0.x11), !cw);
        }
      } else {
        p.lineTo(x11, y11);
        if (innerDa > epsilon) {
          p.arc(0, 0, rInner, innerA0, innerA1, cw);
        }
      }
    }
  }

  p.closePath();
  return p.toString();
}

export function arcCentroid(config: ArcConfig): [number, number] {
  const midAngle = (config.startAngle + config.endAngle) / 2 - Math.PI / 2;
  const midRadius = (config.innerRadius + config.outerRadius) / 2;
  return [midRadius * Math.cos(midAngle), midRadius * Math.sin(midAngle)];
}
