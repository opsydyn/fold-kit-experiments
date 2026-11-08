/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Canonical node shape geometry is a public domain concept. */
import type { Html, HtmlBuilder } from 'foldkit/html';

import { edgePath } from './geometry';
import type { ZlozHistoryChange, ZlozHistoryComparison } from './history';
// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Canonical node outline geometry is a domain concept.
import { nodeShapeGeometry, nodeShapeBoundaryPoint } from './node-shape';
import type { ZlozEdge, ZlozNode } from './types';

export type ZlozHistoryGhostOptions<M> = Readonly<{
  enabled?: boolean;
  nodes?: boolean;
  edges?: boolean;
  movements?: boolean;
  /** Inert SVG content. Undefined keeps the default; null omits the mark. */
  renderNode?: (change: ZlozHistoryChange<ZlozNode>, h: HtmlBuilder<M>) => Html | null | undefined;
  renderEdge?: (change: ZlozHistoryChange<ZlozEdge>, h: HtmlBuilder<M>) => Html | null | undefined;
  renderMovement?: (
    change: ZlozHistoryChange<ZlozNode>,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
}>;
function stroke(kind: string): string {
  return kind === 'removed'
    ? 'var(--flow-invalid-target, #dc2626)'
    : kind === 'added'
      ? 'var(--flow-valid-target, #15803d)'
      : 'var(--flow-selection, #2563eb)';
}
/** Compose explicitly inside renderWorldOverlay. No editor nodes, sockets, hit targets or history entries are created.
 * The SVG is visual-only: expose comparison meaning through the host's accessible legend/list.
 * Custom renderers must remain inert SVG content; keep editing controls outside this layer. */
export function zlozHistoryGhosts<M>(
  h: HtmlBuilder<M>,
  comparison: ZlozHistoryComparison,
  options: ZlozHistoryGhostOptions<M> = {},
): Html | null {
  if (options.enabled === false) return null;
  const nodes =
    options.nodes === false
      ? []
      : comparison.nodes.flatMap((change) => {
          const custom = options.renderNode?.(change, h);
          if (custom !== undefined) return custom === null ? [] : [custom];
          const node = change.before ?? change.after;
          if (!node) return [];
          const old = change.before !== null && (change.kind === 'removed' || change.layoutChanged);
          // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Reuse the core's canonical outline.
          const geometry = nodeShapeGeometry(node);
          return [
            h.g(
              [
                h.DataAttribute('zloz-history-node', change.kind),
                h.DataAttribute('zloz-history-id', change.id),
                h.Transform(`translate(${node.position.x} ${node.position.y})`),
              ],
              [
                h.path(
                  [
                    h.D(geometry.outlinePath),
                    h.Fill(old ? 'var(--flow-node-background, #fff)' : 'none'),
                    h.FillOpacity(old ? '0.2' : '0'),
                    h.Stroke(stroke(change.kind)),
                    h.StrokeWidth('2'),
                    h.StrokeDasharray(change.kind === 'removed' ? '3 5' : '8 5'),
                  ],
                  [],
                ),
                ...geometry.decorationPaths.map((path) =>
                  h.path(
                    [
                      h.D(path),
                      h.Fill('none'),
                      h.Stroke(stroke(change.kind)),
                      h.StrokeDasharray('8 5'),
                    ],
                    [],
                  ),
                ),
                h.text(
                  [
                    h.X('4'),
                    h.Y('-8'),
                    h.Fill(stroke(change.kind)),
                    h.Style({ 'font-size': '12px' }),
                  ],
                  [
                    `${change.kind === 'removed' ? 'Removed' : change.kind === 'added' ? 'Added' : old ? 'Previous' : 'Changed'}: ${node.label}`,
                  ],
                ),
              ],
            ),
          ];
        });
  const edges =
    options.edges === false
      ? []
      : comparison.edges.flatMap((change) => {
          const custom = options.renderEdge?.(change, h);
          if (custom !== undefined) return custom === null ? [] : [custom];
          const edge = change.before ?? change.after;
          if (!edge) return [];
          const graph = change.before
            ? comparison.baseline.snapshot.graph
            : comparison.selected.snapshot.graph;
          return [
            h.path(
              [
                h.DataAttribute('zloz-history-edge', change.kind),
                h.DataAttribute('zloz-history-id', change.id),
                h.D(edgePath(graph, edge)),
                h.Fill('none'),
                h.Stroke(stroke(change.kind)),
                h.StrokeWidth('2'),
                h.StrokeDasharray('5 5'),
                h.Opacity('0.6'),
              ],
              [],
            ),
          ];
        });
  const movements =
    options.movements === false
      ? []
      : comparison.nodes.flatMap((change) => {
          if (
            !change.before ||
            !change.after ||
            (change.before.position.x === change.after.position.x &&
              change.before.position.y === change.after.position.y)
          )
            return [];
          const custom = options.renderMovement?.(change, h);
          if (custom !== undefined) return custom === null ? [] : [custom];
          const a = change.before,
            b = change.after;
          const horizontal =
            Math.abs(b.position.x - a.position.x) >= Math.abs(b.position.y - a.position.y);
          const forward = horizontal ? b.position.x > a.position.x : b.position.y > a.position.y;
          // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Cardinal endpoints use the core outline intersection.
          const start = nodeShapeBoundaryPoint(
            a,
            horizontal ? (forward ? 'right' : 'left') : forward ? 'bottom' : 'top',
            0.5,
          );
          // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- The destination meets its opposite boundary, not its text/body.
          const end = nodeShapeBoundaryPoint(
            b,
            horizontal ? (forward ? 'left' : 'right') : forward ? 'top' : 'bottom',
            0.5,
          );
          const overlap = horizontal
            ? (end.x - start.x) * (b.position.x - a.position.x) <= 0
            : (end.y - start.y) * (b.position.y - a.position.y) <= 0;
          // Overlapping cards use an outside lane rather than an arrow through their text.
          // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Outside lanes meet canonical node boundaries.
          const from = overlap
            ? nodeShapeBoundaryPoint(a, horizontal ? 'top' : 'left', 0.5)
            : start;
          // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Outside lanes meet canonical node boundaries.
          const to = overlap ? nodeShapeBoundaryPoint(b, horizontal ? 'top' : 'left', 0.5) : end;
          const lane = horizontal
            ? Math.min(a.position.y, b.position.y) - 28
            : Math.min(a.position.x, b.position.x) - 28;
          const points = overlap
            ? [
                from,
                horizontal ? { x: from.x, y: lane } : { x: lane, y: from.y },
                horizontal ? { x: to.x, y: lane } : { x: lane, y: to.y },
                to,
              ]
            : [from, to];
          const previous = points[points.length - 2]!;
          const x2 = to.x,
            y2 = to.y;
          const length = Math.max(1, Math.hypot(x2 - previous.x, y2 - previous.y));
          const dx = (x2 - previous.x) / length,
            dy = (y2 - previous.y) / length;
          return [
            h.g(
              [h.DataAttribute('zloz-history-movement', change.id)],
              [
                h.path(
                  [
                    h.D(
                      points
                        .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
                        .join(' '),
                    ),
                    h.Fill('none'),
                    h.Stroke(stroke('changed')),
                    h.StrokeWidth('2'),
                    h.StrokeDasharray('4 4'),
                  ],
                  [],
                ),
                h.path(
                  [
                    h.D(
                      `M${x2},${y2} L${x2 - 9 * dx + 4 * dy},${y2 - 9 * dy - 4 * dx} L${x2 - 9 * dx - 4 * dy},${y2 - 9 * dy + 4 * dx} Z`,
                    ),
                    h.Fill(stroke('changed')),
                  ],
                  [],
                ),
              ],
            ),
          ];
        });
  return h.svg(
    [
      h.DataAttribute('zloz-history-ghosts', ''),
      h.AriaHidden(true),
      h.Style({
        position: 'absolute',
        inset: '0',
        width: '1px',
        height: '1px',
        overflow: 'visible',
        'pointer-events': 'none',
      }),
    ],
    [...edges, ...nodes, ...movements],
  );
}
