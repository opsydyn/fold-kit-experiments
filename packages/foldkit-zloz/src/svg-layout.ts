import { serializeGraph, ZlozError } from './graph';
import type { EdgeRoute, EditorState, ZlozGraph } from './types';

/** ADR 0075: transient export evidence, never part of graph serialization. */
export type ZlozSvgLayoutSnapshot = Readonly<{
  source: string;
  /** Host-owned identity covering labels, fonts, theme and renderer configuration. */
  renderKey: string;
  routes: readonly EdgeRoute[];
}>;
export type ZlozSvgLayoutOptions = Readonly<{
  snapshot: ZlozSvgLayoutSnapshot;
  /** Current renderer identity, compared with the captured key before using geometry. */
  renderKey: string;
}>;
function invalid(): never {
  throw new ZlozError(
    'invalid-edit',
    'SVG layout requires unique existing routes and finite positive label envelopes.',
  );
}
export function copySvgRoutes(
  graph: ZlozGraph,
  routes: readonly EdgeRoute[],
): readonly EdgeRoute[] {
  const seen = new Set<string>();
  return routes.map((route) => {
    if (
      seen.has(route.id) ||
      !graph.edges.some((edge) => edge.id === route.id) ||
      route.points.length < 2
    )
      invalid();
    seen.add(route.id);
    const points = route.points.map((point) => {
      if (![point.x, point.y].every(Number.isFinite)) invalid();
      return { x: point.x, y: point.y };
    });
    if (!route.label) return { id: route.id, points };
    const { position, size } = route.label;
    if (
      ![size.width, size.height].every((value) => Number.isFinite(value) && value > 0) ||
      ![
        position.x,
        position.y,
        position.x - size.width / 2,
        position.y - size.height / 2,
        position.x + size.width / 2,
        position.y + size.height / 2,
      ].every(Number.isFinite)
    )
      invalid();
    return { id: route.id, points, label: { position: { ...position }, size: { ...size } } };
  });
}
/** Capture current editor routes without changing model, viewport, history or source data. */
export function captureSvgLayout(editor: EditorState, renderKey: string): ZlozSvgLayoutSnapshot {
  if (!renderKey.trim() || editor.gesture.type !== 'idle' || editor.edgeLabelDraft !== null)
    throw new ZlozError(
      'invalid-edit',
      'Finish editing and provide a non-blank SVG renderer key before capturing layout.',
    );
  return {
    source: serializeGraph(editor.graph),
    renderKey,
    routes: copySvgRoutes(editor.graph, editor.routes),
  };
}
