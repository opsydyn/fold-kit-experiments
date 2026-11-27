/* oxlint-disable anti-slop/no-shape-in-symbol-names -- The drawing uses the canonical node shape geometry. */
import { edgePath } from './geometry';
import type { ZlozHistoryChange, ZlozHistoryComparison } from './history';
import { nodeShapeGeometry, nodeShapeBoundaryPoint } from './node-shape';
import type { ZlozEdge, ZlozGraph, ZlozNode } from './types';

export type HistoryGhostComparison = Pick<ZlozHistoryComparison, 'nodes' | 'edges'> &
  Readonly<{
    baseline: Readonly<{ snapshot: Readonly<{ graph: ZlozGraph }> }>;
    selected: Readonly<{ snapshot: Readonly<{ graph: ZlozGraph }> }>;
  }>;

type GhostAttributes = Readonly<Record<string, string>>;
export type DrawHistoryGhost<T> = (
  tag: 'svg' | 'g' | 'path' | 'text',
  attributes: GhostAttributes,
  children: readonly (T | string)[],
  style?: Readonly<Record<string, string>>,
) => T;

export type HistoryGhostOptions<T> = Readonly<{
  enabled?: boolean;
  nodes?: boolean;
  edges?: boolean;
  movements?: boolean;
  renderNode?: (change: ZlozHistoryChange<ZlozNode>) => T | null | undefined;
  renderEdge?: (change: ZlozHistoryChange<ZlozEdge>) => T | null | undefined;
  renderMovement?: (change: ZlozHistoryChange<ZlozNode>) => T | null | undefined;
}>;

function stroke(kind: string): string {
  return kind === 'removed'
    ? 'var(--flow-invalid-target, #dc2626)'
    : kind === 'added'
      ? 'var(--flow-valid-target, #15803d)'
      : 'var(--flow-selection, #2563eb)';
}

export function drawHistoryGhosts<T>(
  draw: DrawHistoryGhost<T>,
  comparison: HistoryGhostComparison,
  options: HistoryGhostOptions<T> = {},
  previousLabel = 'Previous',
  displaySide: 'baseline' | 'selected' = 'selected',
): T | null {
  if (options.enabled === false) return null;
  const nodes =
    options.nodes === false
      ? []
      : comparison.nodes.flatMap((change) => {
          const custom = options.renderNode?.(change);
          if (custom !== undefined) return custom === null ? [] : [custom];
          const node =
            displaySide === 'baseline'
              ? (change.after ?? change.before)
              : (change.before ?? change.after);
          if (!node) return [];
          const old =
            displaySide === 'baseline'
              ? change.after !== null && (change.kind === 'added' || change.layoutChanged)
              : change.before !== null && (change.kind === 'removed' || change.layoutChanged);
          // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Reuse the core's canonical outline.
          const geometry = nodeShapeGeometry(node);
          return [
            draw(
              'g',
              {
                'data-zloz-history-node': change.kind,
                'data-zloz-history-id': change.id,
                transform: `translate(${node.position.x} ${node.position.y})`,
              },
              [
                draw(
                  'path',
                  {
                    d: geometry.outlinePath,
                    fill: old ? 'var(--flow-node-background, #fff)' : 'none',
                    'fill-opacity': old ? '0.2' : '0',
                    stroke: stroke(change.kind),
                    'stroke-width': '2',
                    'stroke-dasharray': change.kind === 'removed' ? '3 5' : '8 5',
                  },
                  [],
                ),
                ...geometry.decorationPaths.map((path) =>
                  draw(
                    'path',
                    {
                      d: path,
                      fill: 'none',
                      stroke: stroke(change.kind),
                      'stroke-dasharray': '8 5',
                    },
                    [],
                  ),
                ),
                draw(
                  'text',
                  { x: '4', y: '-8', fill: stroke(change.kind) },
                  [
                    `${change.kind === 'removed' ? 'Removed' : change.kind === 'added' ? 'Added' : old ? previousLabel : 'Changed'}: ${node.label}`,
                  ],
                  { 'font-size': '12px' },
                ),
              ],
            ),
          ];
        });
  const edges =
    options.edges === false
      ? []
      : comparison.edges.flatMap((change) => {
          const custom = options.renderEdge?.(change);
          if (custom !== undefined) return custom === null ? [] : [custom];
          const edge =
            displaySide === 'baseline'
              ? (change.after ?? change.before)
              : (change.before ?? change.after);
          if (!edge) return [];
          const graph =
            displaySide === 'baseline'
              ? change.after
                ? comparison.selected.snapshot.graph
                : comparison.baseline.snapshot.graph
              : change.before
                ? comparison.baseline.snapshot.graph
                : comparison.selected.snapshot.graph;
          return [
            draw(
              'path',
              {
                'data-zloz-history-edge': change.kind,
                'data-zloz-history-id': change.id,
                d: edgePath(graph, edge),
                fill: 'none',
                stroke: stroke(change.kind),
                'stroke-width': '2',
                'stroke-dasharray': '5 5',
                opacity: '0.6',
              },
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
          const custom = options.renderMovement?.(change);
          if (custom !== undefined) return custom === null ? [] : [custom];
          const a = displaySide === 'baseline' ? change.after : change.before,
            b = displaySide === 'baseline' ? change.before : change.after;
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
            draw('g', { 'data-zloz-history-movement': change.id }, [
              draw(
                'path',
                {
                  d: points
                    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
                    .join(' '),
                  fill: 'none',
                  stroke: stroke('changed'),
                  'stroke-width': '2',
                  'stroke-dasharray': '4 4',
                },
                [],
              ),
              draw(
                'path',
                {
                  d: `M${x2},${y2} L${x2 - 9 * dx + 4 * dy},${y2 - 9 * dy - 4 * dx} L${x2 - 9 * dx - 4 * dy},${y2 - 9 * dy + 4 * dx} Z`,
                  fill: stroke('changed'),
                },
                [],
              ),
            ]),
          ];
        });
  return draw(
    'svg',
    { 'data-zloz-history-ghosts': '', 'aria-hidden': 'true' },
    [...edges, ...nodes, ...movements],
    {
      position: 'absolute',
      inset: '0',
      width: '1px',
      height: '1px',
      overflow: 'visible',
      'pointer-events': 'none',
    },
  );
}
