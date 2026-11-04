import type { AlignmentGuide, FlowNode, Point } from './types';

type Axis = AlignmentGuide['axis'];
type Span = Readonly<{ min: number; max: number }>;
type Bounds = Readonly<{ x: Span; y: Span }>;

function boundsOf(node: FlowNode): Bounds {
  return {
    x: { min: node.position.x, max: node.position.x + node.size.width },
    y: { min: node.position.y, max: node.position.y + node.size.height },
  };
}

function selectionBounds(nodes: readonly FlowNode[]): Bounds {
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
  nodes: readonly FlowNode[],
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
