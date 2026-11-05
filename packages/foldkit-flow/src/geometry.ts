import { FlowError } from './graph';
import type { EdgePathStyle, FlowEdge, FlowGraph, FlowNode, Point, Size, Viewport } from './types';

export const gridSpacing = 20;
export const minimumZoom = 0.1;
export const maximumZoom = 4;

export function finitePoint(point: Point): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new FlowError('invalid-edit', 'Point coordinates must be finite');
}
export function validViewport(viewport: Viewport): void {
  finitePoint(viewport);
  if (!Number.isFinite(viewport.zoom) || viewport.zoom < minimumZoom || viewport.zoom > maximumZoom)
    throw new FlowError('invalid-edit', 'Zoom must be between 0.1 and 4');
}
export function screenToWorld(point: Point, viewport: Viewport): Point {
  finitePoint(point);
  validViewport(viewport);
  return { x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom };
}
/** Keep the world point under the cursor stationary while zooming. */
export function zoomAt(viewport: Viewport, point: Point, factor: number): Viewport {
  const world = screenToWorld(point, viewport);
  if (!Number.isFinite(factor) || factor <= 0)
    throw new FlowError('invalid-edit', 'Zoom factor must be positive and finite');
  const zoom = Math.max(minimumZoom, Math.min(maximumZoom, viewport.zoom * factor));
  return { x: point.x - world.x * zoom, y: point.y - world.y * zoom, zoom };
}
export function boxBounds(origin: Point, point: Point) {
  return {
    left: Math.min(origin.x, point.x),
    top: Math.min(origin.y, point.y),
    right: Math.max(origin.x, point.x),
    bottom: Math.max(origin.y, point.y),
  };
}

export function portPosition(node: FlowNode, id: string): Point {
  const port = node.ports.find((item) => item.id === id);
  if (!port) throw new FlowError('invalid-graph', `Unknown port ${id} on ${node.id}`);
  switch (port.side) {
    case 'left':
      return { x: node.position.x, y: node.position.y + node.size.height * port.offset };
    case 'right':
      return {
        x: node.position.x + node.size.width,
        y: node.position.y + node.size.height * port.offset,
      };
    case 'top':
      return { x: node.position.x + node.size.width * port.offset, y: node.position.y };
    case 'bottom':
      return {
        x: node.position.x + node.size.width * port.offset,
        y: node.position.y + node.size.height,
      };
  }
}
/** Same authored padding for new groups and fitting existing boundaries. */
export function fittedGroupBounds(contents: readonly FlowNode[]) {
  const left = Math.min(...contents.map((node) => node.position.x)) - 24;
  const top = Math.min(...contents.map((node) => node.position.y)) - 48;
  const right = Math.max(...contents.map((node) => node.position.x + node.size.width)) + 24;
  const bottom = Math.max(...contents.map((node) => node.position.y + node.size.height)) + 24;
  return {
    position: { x: left, y: top },
    size: { width: right - left, height: bottom - top },
  };
}

export function minimapGeometry(
  graph: Pick<FlowGraph, 'nodes'>,
  surface: Size,
  viewport: Viewport,
) {
  const origin = screenToWorld({ x: 0, y: 0 }, viewport);
  const visible = {
    ...origin,
    width: surface.width / viewport.zoom,
    height: surface.height / viewport.zoom,
  };
  let left = visible.x;
  let top = visible.y;
  let right = visible.x + visible.width;
  let bottom = visible.y + visible.height;
  for (const node of graph.nodes) {
    left = Math.min(left, node.position.x);
    top = Math.min(top, node.position.y);
    right = Math.max(right, node.position.x + node.size.width);
    bottom = Math.max(bottom, node.position.y + node.size.height);
  }
  const height = Math.max(bottom - top, (right - left) / 1.6) * 1.08;
  const width = height * 1.6;
  return {
    visible,
    x: left + (right - left - width) / 2,
    y: top + (bottom - top - height) / 2,
    width,
    height,
  };
}

export function fitViewport(graph: FlowGraph, size: Size, padding = 24): Viewport {
  return fitNodes(graph.nodes, size, padding);
}

export function fitNodes(nodes: readonly FlowNode[], size: Size, padding: number): Viewport {
  if (
    ![size.width, size.height, padding].every(Number.isFinite) ||
    padding < 0 ||
    size.width <= 2 * padding ||
    size.height <= 2 * padding
  )
    throw new FlowError('invalid-edit', 'Viewport must be larger than its padding');
  if (nodes.length === 0) return { x: 0, y: 0, zoom: 1 };
  const left = Math.min(...nodes.map((node) => node.position.x));
  const top = Math.min(...nodes.map((node) => node.position.y));
  const right = Math.max(...nodes.map((node) => node.position.x + node.size.width));
  const bottom = Math.max(...nodes.map((node) => node.position.y + node.size.height));
  const zoom = Math.max(
    minimumZoom,
    Math.min(
      maximumZoom,
      (size.width - 2 * padding) / (right - left),
      (size.height - 2 * padding) / (bottom - top),
    ),
  );
  return {
    x: (size.width - (right + left) * zoom) / 2,
    y: (size.height - (bottom + top) * zoom) / 2,
    zoom,
  };
}
function polyline(points: readonly Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
}

function nodeCenter(node: FlowNode): Point {
  return {
    x: node.position.x + node.size.width / 2,
    y: node.position.y + node.size.height / 2,
  };
}

export function groupBoundaryPoint(group: FlowNode, toward: Point): Point {
  const center = nodeCenter(group);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const distance = Math.max(Math.abs(dx) / group.size.width, Math.abs(dy) / group.size.height);
  if (distance === 0) return { x: center.x + group.size.width / 2, y: center.y };
  return { x: center.x + dx / (2 * distance), y: center.y + dy / (2 * distance) };
}

/** Canonical port or projected collapsed-group boundary anchors in world coordinates. */
export function edgeEndpoints(
  graph: FlowGraph,
  edge: FlowEdge,
  groups?: Readonly<{ source: FlowNode | undefined; target: FlowNode | undefined }>,
) {
  const source = graph.nodes.find((node) => node.id === edge.source.node);
  const target = graph.nodes.find((node) => node.id === edge.target.node);
  if (!source || !target) throw new FlowError('invalid-graph', `Missing endpoint for ${edge.id}`);
  const sourceAnchor = groups?.source
    ? nodeCenter(groups.source)
    : portPosition(source, edge.source.port);
  const targetAnchor = groups?.target
    ? nodeCenter(groups.target)
    : portPosition(target, edge.target.port);
  const start = groups?.source ? groupBoundaryPoint(groups.source, targetAnchor) : sourceAnchor;
  const end = groups?.target ? groupBoundaryPoint(groups.target, sourceAnchor) : targetAnchor;
  return { source: start, target: end };
}

/** The label anchor and SVG path come from the same route. */
export function edgeGeometry(
  graph: FlowGraph,
  edge: FlowEdge,
  route?: readonly Point[],
  groups?: Readonly<{ source: FlowNode | undefined; target: FlowNode | undefined }>,
) {
  if (edge.pathStyle === undefined && route && !groups?.source && !groups?.target) {
    return { path: polyline(route), center: polylineMidpoint(route) };
  }
  const { source: start, target: end } = edgeEndpoints(graph, edge, groups);
  return geometryBetween(start, end, edge.pathStyle);
}

/** Shared built-in path geometry for committed edges and incomplete connection previews. */
export function geometryBetween(start: Point, end: Point, style?: EdgePathStyle) {
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  if (style === 'stepped' || style === 'smooth') {
    const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
    const first = horizontal ? { x: center.x, y: start.y } : { x: start.x, y: center.y };
    const second = horizontal ? { x: center.x, y: end.y } : { x: end.x, y: center.y };
    // Symmetric control points put the label at the curve's arc-length midpoint.
    const path =
      style === 'smooth'
        ? `M${start.x},${start.y} C${first.x},${first.y} ${second.x},${second.y} ${end.x},${end.y}`
        : polyline([start, first, second, end]);
    return { path, center };
  }
  return { path: polyline([start, end]), center };
}

export function edgePath(graph: FlowGraph, edge: FlowEdge, points?: readonly Point[]): string {
  return edgeGeometry(graph, edge, points).path;
}

function polylineMidpoint(points: readonly Point[]): Point | undefined {
  const [first, ...rest] = points;
  if (!first) return undefined;
  const segments: { start: Point; end: Point; length: number }[] = [];
  let previous = first;
  for (const end of rest) {
    segments.push({
      start: previous,
      end,
      length: Math.hypot(end.x - previous.x, end.y - previous.y),
    });
    previous = end;
  }
  let remaining = segments.reduce((sum, segment) => sum + segment.length, 0) / 2;
  for (const { start, end, length } of segments) {
    if (remaining <= length && length > 0) {
      const fraction = remaining / length;
      return {
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
      };
    }
    remaining -= length;
  }
  return first;
}
