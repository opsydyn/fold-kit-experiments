import type { AlignmentGuide, ZlozNode, Point, ResizeHandle } from './types';

type Axis = AlignmentGuide['axis'];
type Span = Readonly<{ min: number; max: number }>;
type Bounds = Readonly<{ x: Span; y: Span }>;

function boundsOf(node: ZlozNode): Bounds {
  return {
    x: { min: node.position.x, max: node.position.x + node.size.width },
    y: { min: node.position.y, max: node.position.y + node.size.height },
  };
}

function selectionBounds(nodes: readonly ZlozNode[]): Bounds {
  return {
    x: {
      min: Math.min(...nodes.map((node) => node.position.x)),
      max: Math.max(...nodes.map((node) => node.position.x + node.size.width)),
    },
    y: {
      min: Math.min(...nodes.map((node) => node.position.y)),
      max: Math.max(...nodes.map((node) => node.position.y + node.size.height)),
    },
  };
}

function anchors(span: Span): readonly number[] {
  return [span.min, (span.min + span.max) / 2, span.max];
}

function nearestAlignment(
  moving: Bounds,
  stationary: readonly Bounds[],
  axis: Axis,
  across: Axis,
  raw: Point,
  zoom: number,
) {
  let nearest: { position: number; adjustment: number; across: Span } | undefined;
  const origin = anchors(moving[axis]);
  const band = moving[across];
  for (const target of stationary) {
    const targetBand = target[across];
    const gap = Math.max(
      targetBand.min - (band.max + raw[across]),
      band.min + raw[across] - targetBand.max,
      0,
    );
    if (gap * zoom > 160) continue;
    const points = anchors(target[axis]);
    for (const [index, from] of origin.entries()) {
      for (const [targetIndex, position] of points.entries()) {
        // Edges can meet either edge. Centers align with centers.
        if ((index === 1) !== (targetIndex === 1)) continue;
        const adjustment = position - (from + raw[axis]);
        const distance = Math.abs(adjustment) * zoom;
        if (distance > 6 || (nearest && Math.abs(nearest.adjustment) <= Math.abs(adjustment)))
          continue;
        nearest = { position, adjustment, across: targetBand };
      }
    }
  }
  return nearest;
}

export function alignDrag(
  nodes: readonly ZlozNode[],
  moving: ReadonlySet<string>,
  collapsedGroups: readonly string[],
  raw: Point,
  fallback: Point,
  zoom: number,
) {
  const selected = nodes.filter((node) => moving.has(node.id));
  if (selected.length === 0) return { offset: fallback, guides: [] };
  const bounds = selectionBounds(selected);
  const collapsed = new Set(collapsedGroups);
  const stationary = nodes
    .filter((node) => !moving.has(node.id) && (node.kind !== 'group' || collapsed.has(node.id)))
    .map(boundsOf);
  const x = nearestAlignment(bounds, stationary, 'x', 'y', raw, zoom);
  const y = nearestAlignment(bounds, stationary, 'y', 'x', raw, zoom);
  const offset = {
    x: x ? raw.x + x.adjustment : fallback.x,
    y: y ? raw.y + y.adjustment : fallback.y,
  };
  const guides: AlignmentGuide[] = [];
  if (x)
    guides.push({
      axis: 'x',
      position: x.position,
      from: Math.min(bounds.y.min + offset.y, x.across.min),
      to: Math.max(bounds.y.max + offset.y, x.across.max),
    });
  if (y)
    guides.push({
      axis: 'y',
      position: y.position,
      from: Math.min(bounds.x.min + offset.x, y.across.min),
      to: Math.max(bounds.x.max + offset.x, y.across.max),
    });
  return { offset, guides };
}

export function sameGuides(left: readonly AlignmentGuide[], right: readonly AlignmentGuide[]) {
  return (
    left.length === right.length &&
    left.every((guide, index) => {
      const other = right[index];
      return (
        guide.axis === other?.axis &&
        guide.position === other.position &&
        guide.from === other.from &&
        guide.to === other.to
      );
    })
  );
}

export type ResizeAlignment = Readonly<{
  axis: Axis;
  position: number;
  offset: number;
  across: Span;
  distance: number;
}>;

/** Only moving edges participate; expanded boundaries and the group's contents are excluded. */
export function alignResize(
  nodes: readonly ZlozNode[],
  group: ZlozNode,
  moving: ReadonlySet<string>,
  collapsedGroups: readonly string[],
  raw: Point,
  handle: ResizeHandle,
  zoom: number,
): readonly ResizeAlignment[] {
  const bounds = boundsOf(group);
  const left = handle.endsWith('left');
  const top = handle.startsWith('top');
  const activeX = handle !== 'top' && handle !== 'bottom';
  const activeY = handle !== 'left' && handle !== 'right';
  const x = activeX ? raw.x : 0;
  const y = activeY ? raw.y : 0;
  const proposed = {
    x: { min: bounds.x.min + (left ? x : 0), max: bounds.x.max + (left ? 0 : x) },
    y: { min: bounds.y.min + (top ? y : 0), max: bounds.y.max + (top ? 0 : y) },
  };
  const collapsed = new Set(collapsedGroups);
  const stationary = nodes
    .filter((node) => !moving.has(node.id) && (node.kind !== 'group' || collapsed.has(node.id)))
    .map(boundsOf);
  const nearest = (axis: Axis, across: Axis, origin: number): ResizeAlignment | undefined => {
    let result: ResizeAlignment | undefined;
    const band = proposed[across];
    for (const target of stationary) {
      const targetBand = target[across];
      const gap = Math.max(
        targetBand.min - Math.max(band.min, band.max),
        Math.min(band.min, band.max) - targetBand.max,
        0,
      );
      if (gap * zoom > 160) continue;
      for (const position of [target[axis].min, target[axis].max]) {
        const distance = Math.abs(position - (origin + raw[axis])) * zoom;
        if (distance > 6 || (result && result.distance <= distance)) continue;
        result = { axis, position, offset: position - origin, across: targetBand, distance };
      }
    }
    return result;
  };
  const matches: ResizeAlignment[] = [];
  if (activeX && raw.x !== 0) {
    const match = nearest('x', 'y', left ? bounds.x.min : bounds.x.max);
    if (match) matches.push(match);
  }
  if (activeY && raw.y !== 0) {
    const match = nearest('y', 'x', top ? bounds.y.min : bounds.y.max);
    if (match) matches.push(match);
  }
  return group.keepAspectRatio
    ? matches.sort((a, b) => a.distance - b.distance).slice(0, 1)
    : matches;
}

/** A constrained resize must never advertise a target it did not reach. */
export function resizeGuides(
  node: ZlozNode,
  handle: ResizeHandle,
  matches: readonly ResizeAlignment[],
  zoom: number,
): readonly AlignmentGuide[] {
  const bounds = boundsOf(node);
  return matches.flatMap((match) => {
    const edge =
      match.axis === 'x'
        ? handle.endsWith('left')
          ? bounds.x.min
          : bounds.x.max
        : handle.startsWith('top')
          ? bounds.y.min
          : bounds.y.max;
    if (Math.abs(edge - match.position) * zoom > 0.000001) return [];
    const across = match.axis === 'x' ? bounds.y : bounds.x;
    return [
      {
        axis: match.axis,
        position: match.position,
        from: Math.min(across.min, match.across.min),
        to: Math.max(across.max, match.across.max),
      },
    ];
  });
}
