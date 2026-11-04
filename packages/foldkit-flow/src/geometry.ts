import { FlowError } from './graph';
import type { FlowEdge, FlowGraph, FlowNode, Point, Size, Viewport } from './types';

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
export function minimapGeometry(graph: FlowGraph, surface: Size, viewport: Viewport) {
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
  if (
    ![size.width, size.height, padding].every(Number.isFinite) ||
    padding < 0 ||
    size.width <= 2 * padding ||
    size.height <= 2 * padding
  )
    throw new FlowError('invalid-edit', 'Viewport must be larger than its padding');
  if (graph.nodes.length === 0) return { x: 0, y: 0, zoom: 1 };
  const left = Math.min(...graph.nodes.map((node) => node.position.x));
  const top = Math.min(...graph.nodes.map((node) => node.position.y));
  const right = Math.max(...graph.nodes.map((node) => node.position.x + node.size.width));
  const bottom = Math.max(...graph.nodes.map((node) => node.position.y + node.size.height));
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
/** Straight fallback; optional layout adapters supply polylines. */
export function edgePath(graph: FlowGraph, edge: FlowEdge, points?: readonly Point[]): string {
  let path = points;
  if (!path) {
    const source = graph.nodes.find((node) => node.id === edge.source.node);
    const target = graph.nodes.find((node) => node.id === edge.target.node);
    if (!source || !target) throw new FlowError('invalid-graph', `Missing endpoint for ${edge.id}`);
    path = [portPosition(source, edge.source.port), portPosition(target, edge.target.port)];
  }
  return path.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
}
