import type { ZlozConnectionMode } from './connection-mode';
import { compareHistoryGraphs } from './history';
import type { ZlozHistoryChange } from './history';
import { captureEditionV2 } from './model-document-v2';
import type { ZlozEditionV2 } from './model-document-v2';
import type { ZlozEdge, ZlozNode } from './types';

/** Mode is checkpoint meaning, independently of node/edge changes. */
export type ZlozHistoryModeChangeV2 =
  | Readonly<{ kind: 'unchanged'; mode: ZlozConnectionMode }>
  | Readonly<{ kind: 'changed'; before: 'strict'; after: 'loose' }>
  | Readonly<{ kind: 'changed'; before: 'loose'; after: 'strict' }>;

export type ZlozHistoryComparisonV2 = Readonly<{
  baseline: ZlozEditionV2;
  selected: ZlozEditionV2;
  nodes: readonly ZlozHistoryChange<ZlozNode>[];
  edges: readonly ZlozHistoryChange<ZlozEdge>[];
  modeChange: ZlozHistoryModeChangeV2;
  /** Mode or graph meaning changed; checkpoint metadata and camera are excluded. */
  semanticChanged: boolean;
  /** Graph presentation changed; checkpoint camera is excluded. */
  layoutChanged: boolean;
}>;

/** Validate, detach and compare two explicit checkpoints without changing either editor. */
export function compareEditionsV2(
  baseline: ZlozEditionV2,
  selected: ZlozEditionV2,
): ZlozHistoryComparisonV2 {
  const before = captureEditionV2(baseline);
  const after = captureEditionV2(selected);
  const previousMode = before.snapshot.connectionMode;
  const currentMode = after.snapshot.connectionMode;
  const modeChange: ZlozHistoryModeChangeV2 =
    previousMode === currentMode
      ? { kind: 'unchanged', mode: previousMode }
      : previousMode === 'strict'
        ? { kind: 'changed', before: 'strict', after: 'loose' }
        : { kind: 'changed', before: 'loose', after: 'strict' };
  const graph = compareHistoryGraphs(before.snapshot.graph, after.snapshot.graph);
  return Object.freeze({
    baseline: before,
    selected: after,
    nodes: Object.freeze(graph.nodes.map((change) => Object.freeze(change))),
    edges: Object.freeze(graph.edges.map((change) => Object.freeze(change))),
    modeChange: Object.freeze(modeChange),
    semanticChanged:
      modeChange.kind === 'changed' ||
      graph.nodes.some((change) => change.semanticChanged) ||
      graph.edges.some((change) => change.semanticChanged),
    layoutChanged:
      graph.nodes.some((change) => change.layoutChanged) ||
      graph.edges.some((change) => change.layoutChanged),
  });
}
