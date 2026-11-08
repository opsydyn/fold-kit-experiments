/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholder names. */
import { isNodeAppearance, type FlowNodeShape } from './architecture';
import { FlowError } from './graph';
import type { FlowNode, Point, Port, Size } from './types';

/** Local SVG/content geometry; position belongs to the node, not to this outline. */
export type FlowNodeShapeGeometry = Readonly<{
  shape: FlowNodeShape;
  bounds: Readonly<Point & Size>;
  contentBounds: Readonly<Point & Size>;
  outlinePath: string;
}>;

function metrics(node: FlowNode) {
  const { width: w, height: h } = node.size;
  if (
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w <= 0 ||
    h <= 0 ||
    (node.appearance !== undefined && !isNodeAppearance(node.appearance))
  )
    throw new FlowError(
      'invalid-edit',
      'Shape geometry requires positive finite dimensions and a valid appearance',
    );
  return {
    w,
    h,
    shape: node.appearance?.shape ?? 'rectangle',
    radius: Math.min(12, w / 2, h / 2),
    cap: Math.min(16, w / 4, h / 4),
  };
}

/** ADR 0005: all outlines fit the authored layout/selection envelope. */
export function nodeShapeGeometry(node: FlowNode): FlowNodeShapeGeometry {
  const { w, h, radius: r, cap: c, shape } = metrics(node);
  const bounds = { x: 0, y: 0, width: w, height: h };
  switch (shape) {
    case 'rectangle':
      return { shape, bounds, contentBounds: bounds, outlinePath: `M0,0 H${w} V${h} H0 Z` };
    case 'rounded-rectangle': {
      // A square inset by r(1 - 1/sqrt(2)) fits inside each circular corner.
      const inset = r * (1 - Math.SQRT1_2);
      return {
        shape,
        bounds,
        contentBounds: { x: inset, y: inset, width: w - 2 * inset, height: h - 2 * inset },
        outlinePath: `M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r} V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${r} A${r},${r} 0 0 1 0,${h - r} V${r} A${r},${r} 0 0 1 ${r},0 Z`,
      };
    }
    case 'cylinder':
      return {
        shape,
        bounds,
        contentBounds: { x: 0, y: 2 * c, width: w, height: h - 4 * c },
        outlinePath: `M0,${c} A${w / 2},${c} 0 0 1 ${w},${c} L${w},${h - c} A${w / 2},${c} 0 0 1 0,${h - c} Z`,
      };
  }
}

/** World-space intersection with the outline along a cardinal direction at an envelope offset. */
export function nodeShapeBoundaryPoint(node: FlowNode, side: Port['side'], offset: number): Point {
  if (
    !['left', 'right', 'top', 'bottom'].includes(side) ||
    !Number.isFinite(offset) ||
    offset < 0 ||
    offset > 1 ||
    !Number.isFinite(node.position.x) ||
    !Number.isFinite(node.position.y)
  )
    throw new FlowError(
      'invalid-edit',
      'Shape projection requires finite positions and an offset between zero and one',
    );
  const { w, h, radius: r, cap: c, shape } = metrics(node);
  const horizontal = side === 'top' || side === 'bottom';
  const along = offset * (horizontal ? w : h);
  let inset = 0;
  if (shape === 'rounded-rectangle') {
    const length = horizontal ? w : h;
    const distance = along < r ? r - along : along > length - r ? along - (length - r) : 0;
    inset = r - Math.sqrt(Math.max(0, r * r - distance * distance));
  } else if (shape === 'cylinder') {
    if (horizontal) {
      const u = 2 * offset - 1;
      inset = c * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
    } else {
      const distance = along < c ? (c - along) / c : along > h - c ? (along - (h - c)) / c : 0;
      inset = (w / 2) * (1 - Math.sqrt(Math.max(0, 1 - distance * distance)));
    }
  }
  const local =
    side === 'left'
      ? { x: inset, y: along }
      : side === 'right'
        ? { x: w - inset, y: along }
        : side === 'top'
          ? { x: along, y: inset }
          : { x: along, y: h - inset };
  return { x: node.position.x + local.x, y: node.position.y + local.y };
}

/** Inclusive world-space outline hit test. Selection/grouping retain their rectangular envelope. */
export function nodeShapeContainsPoint(node: FlowNode, point: Point): boolean {
  const { w, h, radius: r, cap: c, shape } = metrics(node);
  const x = point.x - node.position.x,
    y = point.y - node.position.y;
  const tolerance = 1e-9 * Math.max(1, w, h);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < -tolerance ||
    x > w + tolerance ||
    y < -tolerance ||
    y > h + tolerance
  )
    return false;
  if (shape === 'rectangle') return true;
  if (shape === 'rounded-rectangle') {
    const cx = Math.max(r, Math.min(w - r, x)),
      cy = Math.max(r, Math.min(h - r, y));
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + tolerance * Math.max(1, r);
  }
  if (y >= c && y <= h - c) return true;
  const cy = y < c ? c : h - c;
  return ((x - w / 2) / (w / 2)) ** 2 + ((y - cy) / c) ** 2 <= 1 + 1e-9;
}
