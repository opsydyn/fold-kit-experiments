import { captureGroupWorkbenchDocumentV3 } from '@opsydyn/foldkit-zloz';
import {
  groupMermaidReviewForScopeV3,
  resolveGroupMermaidReviewV3,
  type ZlozGroupMermaidReviewContextV3,
} from '@opsydyn/foldkit-zloz-mermaid';
import type { MermaidDiagnostic } from '@opsydyn/foldkit-zloz-mermaid';

import type { ReadyState } from './main';
export function groupMermaidContext(state: ReadyState): ZlozGroupMermaidReviewContextV3 {
  const current = state.review?.workbench ?? state.workbench;
  return {
    scope: `${current.editor.sessionId}:mermaid`,
    sourceRevision: current.editor.revision,
    document: captureGroupWorkbenchDocumentV3(current),
    canDownload: () =>
      state.protectMermaid
        ? 'Mermaid exports are protected in this workspace.'
        : current.gesture.type !== 'idle'
          ? 'Finish the active gesture before exporting Mermaid.'
          : state.pendingLayout
            ? 'Wait for or cancel layout before exporting Mermaid.'
            : null,
  };
}
export function groupMermaidControls(state: ReadyState) {
  const context = groupMermaidContext(state);
  return resolveGroupMermaidReviewV3(
    groupMermaidReviewForScopeV3(state.mermaidReview, context.scope),
    context,
  );
}

/** Friendly labels are host composition; exact IDs remain in finding metadata and tooltips. */
export function groupMermaidFindingLabel(
  state: ReadyState,
  finding: MermaidDiagnostic,
): string | null {
  if (finding.subject === null) return null;
  const graph = (state.review?.workbench ?? state.workbench).editor.document.graph;
  const node = graph.nodes.find((n) => n.id === finding.subject);
  if (node) return node.label;
  const edge = graph.edges.find((e) => e.id === finding.subject);
  if (!edge) return finding.subject;
  return (
    edge.label ??
    `${graph.nodes.find((n) => n.id === edge.source.node)?.label ?? edge.source.node} → ${graph.nodes.find((n) => n.id === edge.target.node)?.label ?? edge.target.node}`
  );
}
