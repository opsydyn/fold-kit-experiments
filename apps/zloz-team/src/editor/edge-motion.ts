import type { ZlozOperationDocument } from '@opsydyn/foldkit-zloz';

import { prefersReducedMotion } from '../appearance/preferences';

/** Edge clocks retain used IDs, including edges restored by Undo. */
export function introducedEdges(before: ZlozOperationDocument, after: ZlozOperationDocument) {
  if (before.graph.edges === after.graph.edges || before.version >= after.version) return [];
  const knownIds = new Set(before.edges.map((edge) => edge.id));
  return after.graph.edges.filter((edge) => !knownIds.has(edge.id)).map((edge) => edge.id);
}

/** Only the painted stroke moves. The labelled hit path and layout stay available. */
export function revealEdgeStrokes(run: number, edgeIds: readonly string[]) {
  if (prefersReducedMotion()) return;
  const board = document.querySelector(`[data-edge-motion-run="${run}"]`);
  if (!board) return;
  for (const id of edgeIds) {
    const stroke = board.querySelector(`[data-flow-edge-stroke="${CSS.escape(id)}"]`);
    if (!(stroke instanceof SVGPathElement) || stroke.getAttribute('stroke-dasharray') !== 'none')
      continue;
    const length = stroke.getTotalLength();
    if (!(length > 0)) continue;
    const dash = String(length);
    stroke.animate(
      [
        { strokeDasharray: dash, strokeDashoffset: dash, markerEnd: 'none' },
        { strokeDasharray: dash, strokeDashoffset: '0', markerEnd: 'none' },
      ],
      { duration: 220, easing: 'ease-out' },
    );
  }
}
