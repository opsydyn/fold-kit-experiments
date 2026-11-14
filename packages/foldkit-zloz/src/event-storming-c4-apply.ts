import { isNodeArchitecture } from './architecture';
import { commitGraph } from './editor';
import {
  resolveEventStormingC4ConversionConsent,
  createEventStormingC4ConversionPlan,
  type ZlozEventStormingC4ConversionPlan,
  type ZlozEventStormingC4ConversionOptions,
  type ZlozEventStormingC4LossConsent,
} from './event-storming-c4-conversion-plan';
import type { ZlozEventStormingC4Source } from './event-storming-c4-preview';
import { projectEventStormingC4Graph } from './event-storming-c4-projection';
import { ZlozError } from './graph';
import { historyValueEqual } from './history';
import { captureModelDocument, parseModelDocument, type ZlozModelDocument } from './model-document';
import type { EditorPolicy, EditorState, ZlozNode, ZlozEdge, ZlozGraph } from './types';

type ReviewablePlan = Extract<ZlozEventStormingC4ConversionPlan, { type: 'reviewable' }>;
/** Unsigned portable v1 conversion receipt. Source provenance is separate from edition-fork ancestry. */
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

// Data-only boundary. Structural guards establish types; the plan validates domain intent.
type ReceiptFields = Readonly<{
  format?: unknown;
  version?: unknown;
  source?: unknown;
  options?: unknown;
  lossesAccepted?: unknown;
  document?: unknown;
  sessionId?: unknown;
  revision?: unknown;
  mappings?: unknown;
  memberships?: unknown;
  nodes?: unknown;
  edges?: unknown;
  nodeId?: unknown;
  edgeId?: unknown;
  architecture?: unknown;
  label?: unknown;
  relationship?: unknown;
  placement?: unknown;
  type?: unknown;
  parentId?: unknown;
}>;
function receiptRecord(value: unknown): value is ReceiptFields {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function receiptFields(value: ReceiptFields, names: readonly string[]): boolean {
  return Object.keys(value).every((key) => names.includes(key));
}
function receiptText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function receiptRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function nodeChoice(
  value: unknown,
): value is NonNullable<
  NonNullable<ZlozEventStormingC4ConversionOptions['mappings']>['nodes']
>[number] {
  return (
    receiptRecord(value) &&
    receiptFields(value, ['nodeId', 'architecture', 'label']) &&
    receiptText(value.nodeId) &&
    (value.architecture === null ||
      (isNodeArchitecture(value.architecture) && value.architecture.family === 'c4')) &&
    (value.label === undefined || receiptText(value.label))
  );
}
function edgeChoice(
  value: unknown,
): value is NonNullable<
  NonNullable<ZlozEventStormingC4ConversionOptions['mappings']>['edges']
>[number] {
  return (
    receiptRecord(value) &&
    receiptFields(value, ['edgeId', 'relationship']) &&
    receiptText(value.edgeId) &&
    (value.relationship === null ||
      (receiptRecord(value.relationship) &&
        receiptFields(value.relationship, ['label']) &&
        receiptText(value.relationship.label)))
  );
}
function memberChoice(
  value: unknown,
): value is NonNullable<ZlozEventStormingC4ConversionOptions['memberships']>[number] {
  if (
    !receiptRecord(value) ||
    !receiptFields(value, ['nodeId', 'placement']) ||
    !receiptText(value.nodeId) ||
    !receiptRecord(value.placement)
  )
    return false;
  const placement = value.placement;
  return placement.type === 'contained'
    ? receiptFields(placement, ['type', 'parentId']) && receiptText(placement.parentId)
    : (placement.type === 'root' || placement.type === 'organization') &&
        receiptFields(placement, ['type']);
}
function receiptOptions(value: unknown): value is ZlozEventStormingC4ConversionOptions {
  if (!receiptRecord(value) || !receiptFields(value, ['mappings', 'memberships'])) return false;
  const mappings = value.mappings;
  return (
    (mappings === undefined ||
      (receiptRecord(mappings) &&
        receiptFields(mappings, ['nodes', 'edges']) &&
        (mappings.nodes === undefined ||
          (Array.isArray(mappings.nodes) && mappings.nodes.every(nodeChoice))) &&
        (mappings.edges === undefined ||
          (Array.isArray(mappings.edges) && mappings.edges.every(edgeChoice))))) &&
    (value.memberships === undefined ||
      (Array.isArray(value.memberships) && value.memberships.every(memberChoice)))
  );
}
function invalidReceipt(): never {
  throw new ZlozError('invalid-graph', 'Invalid or unsupported C4 conversion receipt.');
}
function receiptDocument(value: ReceiptFields): ZlozModelDocument {
  return parseModelDocument(
    JSON.stringify({ format: 'foldkit-zloz-model', version: 1, document: value }),
  );
}
function captureReceipt(value: ReceiptFields): ZlozEventStormingC4Conversion {
  if (
    !receiptRecord(value) ||
    !receiptFields(value, [
      'format',
      'version',
      'source',
      'options',
      'lossesAccepted',
      'document',
    ]) ||
    value.format !== 'foldkit-zloz-c4-conversion' ||
    value.version !== 1 ||
    value.lossesAccepted !== true ||
    !receiptRecord(value.source) ||
    !receiptFields(value.source, ['document', 'sessionId', 'revision']) ||
    !receiptText(value.source.sessionId) ||
    !receiptRevision(value.source.revision) ||
    !receiptOptions(value.options) ||
    !receiptRecord(value.source.document) ||
    !receiptRecord(value.document)
  )
    return invalidReceipt();
  const plan = createEventStormingC4ConversionPlan(
    {
      document: receiptDocument(value.source.document),
      sessionId: value.source.sessionId,
      revision: value.source.revision,
    },
    value.options,
  );
  if (plan.type !== 'reviewable' || plan.provenance.document.snapshot.viewport === undefined)
    return invalidReceipt();
  const target = convertedDocument(plan);
  if (!historyValueEqual(receiptDocument(value.document), target)) return invalidReceipt();
  return receipt(plan, target);
}
/** Validate before exporting the entire record; model-only JSON omits conversion receipts. */
export function serializeEventStormingC4Conversion(
  conversion: ZlozEventStormingC4Conversion,
): string {
  if (!receiptRecord(conversion)) return invalidReceipt();
  return JSON.stringify(captureReceipt(conversion));
}
/** Strict v1 data boundary. Validates consistency, not authorship, current consent or Apply authority. */
export function parseEventStormingC4Conversion(json: string): ZlozEventStormingC4Conversion {
  let value: unknown;
  // oxlint-disable-next-line linteffect/no-try-catch -- Dependency-free receipt JSON boundary translates native syntax errors.
  try {
    value = JSON.parse(json);
  } catch {
    return invalidReceipt();
  }
  if (!receiptRecord(value)) return invalidReceipt();
  return captureReceipt(value);
}
