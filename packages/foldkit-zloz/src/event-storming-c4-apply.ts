import { commitGraph } from './editor';
import {
  resolveEventStormingC4ConversionConsent,
  type ZlozEventStormingC4ConversionPlan,
  type ZlozEventStormingC4ConversionOptions,
  type ZlozEventStormingC4LossConsent,
} from './event-storming-c4-conversion-plan';
import type { ZlozEventStormingC4Source } from './event-storming-c4-preview';
import { projectEventStormingC4Graph } from './event-storming-c4-projection';
import { ZlozError } from './graph';
import { historyValueEqual } from './history';
import { captureModelDocument, type ZlozModelDocument } from './model-document';
import type { EditorPolicy, EditorState, ZlozNode, ZlozEdge, ZlozGraph } from './types';

type ReviewablePlan = Extract<ZlozEventStormingC4ConversionPlan, { type: 'reviewable' }>;
/** In-memory unsigned conversion record (no portable decoder in this contract). Source provenance is separate from edition-fork ancestry. */
export type ZlozEventStormingC4Conversion = Readonly<{
  format: 'foldkit-zloz-c4-conversion';
  version: 1;
  source: ZlozEventStormingC4Source;
  options: ZlozEventStormingC4ConversionOptions;
  lossesAccepted: true;
  document: ZlozModelDocument;
}>;
export type ZlozEventStormingC4ApplyPolicy = EditorPolicy &
  Readonly<{
    /** Veto node renaming separately from descriptor edits. Full proposed node, current graph. */
    canChangeC4NodeLabel?: (node: ZlozNode, next: ZlozNode, graph: ZlozGraph) => string | null;
    /** Veto relationship renaming separately from clearing workshop semantics. */
    canChangeC4EdgeLabel?: (edge: ZlozEdge, next: ZlozEdge, graph: ZlozGraph) => string | null;
    /** Veto changed parent constraints or explicit containment, even with the same parent ID. */
    canChangeC4Membership?: (node: ZlozNode, next: ZlozNode, graph: ZlozGraph) => string | null;
    /** Whole-transaction veto; inspect complete frozen source/target values before publication. */
    canApplyEventStormingC4Conversion?: (
      plan: Extract<ZlozEventStormingC4ConversionPlan, { type: 'reviewable' }>,
      target: ZlozModelDocument,
    ) => string | null;
  }>;
export type ZlozEventStormingC4ApplyOptions = Readonly<{
  conversion?: ZlozEventStormingC4ConversionOptions;
  consent: ZlozEventStormingC4LossConsent | null;
  policy?: ZlozEventStormingC4ApplyPolicy;
  /** Current host-only busy condition (imports, layout, external drafts), not a cached permission. */
  blockedReason?: string | null;
}>;
export type ZlozEventStormingC4ApplyResult =
  | Readonly<{ type: 'applied'; editor: EditorState; conversion: ZlozEventStormingC4Conversion }>
  | Readonly<{ type: 'unchanged'; editor: EditorState }>
  | Readonly<{
      type: 'blocked';
      editor: EditorState;
      code:
        | 'source-changed'
        | 'read-only'
        | 'busy'
        | 'undo-disabled'
        | 'consent-required'
        | 'unresolved-mapping'
        | 'policy';
      reason: string;
    }>;
function convertedDocument(plan: ReviewablePlan): ZlozModelDocument {
  const source = plan.provenance.document;
  return captureModelDocument({
    ...source,
    snapshot: {
      ...source.snapshot,
      graph: projectEventStormingC4Graph(source.snapshot.graph, plan.changes),
    },
  });
}
function receipt(plan: ReviewablePlan, document: ZlozModelDocument): ZlozEventStormingC4Conversion {
  return Object.freeze({
    format: 'foldkit-zloz-c4-conversion',
    version: 1,
    source: plan.provenance,
    options: Object.freeze({ mappings: plan.mappings, memberships: plan.membershipChoices }),
    lossesAccepted: true,
    document,
  });
}
const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'C4 conversion is protected.';
/**
 * Synchronous atomic publication from the live editor/document/session. Never accepts a prepared
 * plan or imported receipt as authority. Source snapshot must include the exact live camera.
 * Pure host policies receive detached frozen values; granular hooks retain current-graph semantics.
 * Caller must publish the returned editor and retain the conversion receipt together, without an
 * intervening await. Storage, host scope authenticity and external busy conditions belong to host.
 */
export function applyEventStormingC4Conversion(
  editor: EditorState,
  source: ZlozEventStormingC4Source,
  options: ZlozEventStormingC4ApplyOptions,
): ZlozEventStormingC4ApplyResult {
  const review = resolveEventStormingC4ConversionConsent(
    source,
    options.conversion,
    options.consent,
  );
  const checked = review.plan.provenance;
  const block = (
    code: Extract<ZlozEventStormingC4ApplyResult, { type: 'blocked' }>['code'],
    reason: string,
  ): ZlozEventStormingC4ApplyResult => ({ type: 'blocked', editor, code, reason });
  if (
    checked.revision !== editor.revision ||
    !historyValueEqual(checked.document.snapshot.graph, editor.graph) ||
    checked.document.snapshot.viewport === undefined ||
    !historyValueEqual(checked.document.snapshot.viewport, editor.viewport)
  )
    return block(
      'source-changed',
      'The live graph, camera or revision differs from the source. Review the current model.',
    );
  if (editor.readOnly) return block('read-only', 'The working model is read-only.');
  if (
    editor.gesture.type !== 'idle' ||
    editor.connection !== null ||
    editor.edgeLabelDraft !== null ||
    editor.fitViewTransition.type !== 'idle'
  )
    return block(
      'busy',
      'Finish the active gesture, connection, label draft or camera fit before converting.',
    );
  const busy = denial(options.blockedReason);
  if (busy !== null) return block('busy', busy);
  if (review.type === 'blocked')
    return block(
      'unresolved-mapping',
      review.plan.blockers[0]?.reason ?? 'Resolve every uncertain mapping before converting.',
    );
  if (review.type === 'unchanged') return { type: 'unchanged', editor };
  if (editor.historyLimit === 0)
    return block('undo-disabled', 'Enable graph Undo before converting.');
  if (review.type === 'consent-required') return block('consent-required', review.reason);
  const plan = review.plan,
    target = convertedDocument(plan),
    policy = options.policy ?? {};
  const bulk = denial(policy.canApplyEventStormingC4Conversion?.(plan, target));
  if (bulk !== null) return block('policy', bulk);
  const before = plan.provenance.document.snapshot.graph,
    after = target.snapshot.graph;
  for (const change of plan.changes.nodes) {
    const node = before.nodes.find((item) => item.id === change.nodeId),
      next = after.nodes.find((item) => item.id === change.nodeId);
    if (!node || !next) throw new ZlozError('invalid-edit', 'Conversion node identity changed.');
    const reason = denial(policy.canChangeNodeArchitecture?.(node, next, before));
    if (reason !== null) return block('policy', reason);
    const label =
      node.label === next.label ? null : denial(policy.canChangeC4NodeLabel?.(node, next, before));
    if (label !== null) return block('policy', label);
  }
  for (const change of plan.changes.edges) {
    const edge = before.edges.find((item) => item.id === change.edgeId),
      next = after.edges.find((item) => item.id === change.edgeId);
    if (!edge || !next) throw new ZlozError('invalid-edit', 'Conversion edge identity changed.');
    const reason = denial(policy.canChangeEdgeArchitecture?.(edge, next, before));
    if (reason !== null) return block('policy', reason);
    const label =
      edge.label === next.label ? null : denial(policy.canChangeC4EdgeLabel?.(edge, next, before));
    if (label !== null) return block('policy', label);
  }
  for (const change of plan.changes.memberships) {
    const node = before.nodes.find((item) => item.id === change.nodeId),
      next = after.nodes.find((item) => item.id === change.nodeId);
    if (!node || !next)
      throw new ZlozError('invalid-edit', 'Conversion membership identity changed.');
    const reason = denial(policy.canChangeC4Membership?.(node, next, before));
    if (reason !== null) return block('policy', reason);
  }
  const conversion = receipt(plan, target);
  return { type: 'applied', editor: commitGraph(editor, target.snapshot.graph), conversion };
}
