import type { LayoutRequest, LayoutResult } from '@opsydyn/foldkit-flow';
import { runForceLayout } from '@opsydyn/foldkit-viz/simulation';

import { supportsForceLayout } from './layout-options';

export function arrangeWithForce(request: LayoutRequest): LayoutResult {
  const { graph, requestId, revision } = request;
  if (!supportsForceLayout(graph))
    throw new Error('Force layout requires a flat graph of 1–100 nodes.');

  // Use a circle that encloses the largest card, with room around its corners.
  const radius =
    Math.max(...graph.nodes.map(({ size }) => Math.hypot(size.width, size.height) / 2)) + 12;
  const layout = runForceLayout({
    nodes: graph.nodes,
    links: graph.edges.map(({ source, target }) => ({ source: source.node, target: target.node })),
    collideRadius: radius,
    linkDistance: 2 * radius + 24,
  });
  const centers = new Map(layout.nodes.map((node) => [node.id, node]));
  const cards = graph.nodes.map(({ id, size }) => {
    const center = centers.get(id);
    if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y))
      throw new Error(`Force layout returned an invalid position for ${id}.`);
    return { id, x: center.x - size.width / 2, y: center.y - size.height / 2, size };
  });
  if (
    cards.some((card, index) =>
      cards
        .slice(index + 1)
        .some(
          (other) =>
            card.x < other.x + other.size.width &&
            other.x < card.x + card.size.width &&
            card.y < other.y + other.size.height &&
            other.y < card.y + card.size.height,
        ),
    )
  )
    throw new Error('Force layout left overlapping cards.');
  return {
    requestId,
    revision,
    positions: cards.map(({ id, x, y }) => ({ id, x, y })),
    routes: [],
  };
}
