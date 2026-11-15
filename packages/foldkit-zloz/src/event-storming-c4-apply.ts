import { isNodeArchitecture } from './architecture';
import { commitGraph } from './editor';
import {
  resolveEventStormingC4ConversionConsent,
  resolveEventStormingC4ConversionConsentV2,
  type ZlozEventStormingC4ConversionConsentDecision,
  createEventStormingC4ConversionPlan,
  createEventStormingC4ConversionPlanV2,
  type ZlozEventStormingC4ConversionPlan,
  type ZlozEventStormingC4ConversionOptions,
  type ZlozEventStormingC4LossConsent,
} from './event-storming-c4-conversion-plan';
import type { ZlozEventStormingC4Source } from './event-storming-c4-preview';
import { projectEventStormingC4Graph } from './event-storming-c4-projection';
import { ZlozError } from './graph';
import { historyValueEqual } from './history';
import { captureModelDocument, parseModelDocument, type ZlozModelDocument } from './model-document';
import {
  captureModelDocumentV2,
  parseModelDocumentV2,
  type ZlozModelDocumentV2,
} from './model-document-v2';
import { ownedData } from './modelling-patch';
import { readPortableEvidenceJson } from './parse-modelling-patch';
import type { EditorPolicy, EditorState, ZlozNode, ZlozEdge, ZlozGraph } from './types';

type ReviewablePlan<D extends ZlozModelDocument = ZlozModelDocument> = Extract<
  ZlozEventStormingC4ConversionPlan<D>,
  { type: 'reviewable' }
>;
/** Unsigned portable v1 conversion receipt. Source provenance is separate from edition-fork ancestry. */
export type ZlozEventStormingC4Conversion<
  D extends ZlozModelDocument = ZlozModelDocument,
  V extends 1 | 2 = 1,
> = Readonly<{
  format: 'foldkit-zloz-c4-conversion';
  version: V;
  source: ZlozEventStormingC4Source<D>;
  options: ZlozEventStormingC4ConversionOptions;
  lossesAccepted: true;
  document: D;
}>;
export type ZlozEventStormingC4ApplyPolicy<D extends ZlozModelDocument = ZlozModelDocument> =
  EditorPolicy &
    Readonly<{
      /** Veto node renaming separately from descriptor edits. Full proposed node, current graph. */
      canChangeC4NodeLabel?: (node: ZlozNode, next: ZlozNode, graph: ZlozGraph) => string | null;
      /** Veto relationship renaming separately from clearing workshop semantics. */
      canChangeC4EdgeLabel?: (edge: ZlozEdge, next: ZlozEdge, graph: ZlozGraph) => string | null;
      /** Veto changed parent constraints or explicit containment, even with the same parent ID. */
      canChangeC4Membership?: (node: ZlozNode, next: ZlozNode, graph: ZlozGraph) => string | null;
      /** Whole-transaction veto; inspect complete frozen source/target values before publication. */
      canApplyEventStormingC4Conversion?: (
        plan: Extract<ZlozEventStormingC4ConversionPlan<D>, { type: 'reviewable' }>,
        target: D,
      ) => string | null;
    }>;
export type ZlozEventStormingC4ApplyOptions<D extends ZlozModelDocument = ZlozModelDocument> =
  Readonly<{
    conversion?: ZlozEventStormingC4ConversionOptions;
    consent: ZlozEventStormingC4LossConsent | null;
    policy?: ZlozEventStormingC4ApplyPolicy<D>;
    /** Current host-only busy condition (imports, layout, external drafts), not a cached permission. */
    blockedReason?: string | null;
  }>;
export type ZlozEventStormingC4ApplyResult<
  D extends ZlozModelDocument = ZlozModelDocument,
  V extends 1 | 2 = 1,
> =
  | Readonly<{
      type: 'applied';
      editor: EditorState;
      conversion: ZlozEventStormingC4Conversion<D, V>;
    }>
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
function convertedDocument<D extends ZlozModelDocument>(
  plan: ReviewablePlan<D>,
  capture: (document: D) => D,
): D {
  const source = plan.provenance.document;
  return capture({
    ...source,
    snapshot: {
      ...source.snapshot,
      graph: projectEventStormingC4Graph(source.snapshot.graph, plan.changes),
    },
  });
}
function receipt<D extends ZlozModelDocument, V extends 1 | 2>(
  plan: ReviewablePlan<D>,
  document: D,
  version: V,
): ZlozEventStormingC4Conversion<D, V> {
  return Object.freeze({
    format: 'foldkit-zloz-c4-conversion',
    version,
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
function applyConversion<D extends ZlozModelDocument, V extends 1 | 2>(
  editor: EditorState,
  source: ZlozEventStormingC4Source<D>,
  options: ZlozEventStormingC4ApplyOptions<D>,
  resolve: (
    source: ZlozEventStormingC4Source<D>,
    choices?: ZlozEventStormingC4ConversionOptions,
    consent?: ZlozEventStormingC4LossConsent | null,
  ) => ZlozEventStormingC4ConversionConsentDecision<D>,
  capture: (document: D) => D,
  version: V,
): ZlozEventStormingC4ApplyResult<D, V> {
  const review = resolve(source, options.conversion, options.consent);
  const checked = review.plan.provenance;
  const block = (
    code: Extract<ZlozEventStormingC4ApplyResult<D, V>, { type: 'blocked' }>['code'],
    reason: string,
  ): ZlozEventStormingC4ApplyResult<D, V> => ({ type: 'blocked', editor, code, reason });
  const checkpoint = checked.document.snapshot;
  const mode = 'connectionMode' in checkpoint ? checkpoint.connectionMode : 'strict';
  if (version === 2 && !editor.connectionHistory)
    return block('source-changed', 'Initialize a v2 model session before conversion.');
  if (
    mode !== (editor.connectionMode ?? 'strict') ||
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
  if (version === 2 && editor.revision >= Number.MAX_SAFE_INTEGER)
    return block('source-changed', 'Editor revision counter is exhausted.');
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
    target = convertedDocument(plan, capture),
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
  const conversion = receipt(plan, target, version);
  if (version === 2) readPortableEvidenceJson(JSON.stringify(conversion));
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
function captureReceiptFor<D extends ZlozModelDocument, V extends 1 | 2>(
  value: ReceiptFields,
  version: V,
  decode: (value: ReceiptFields) => D,
  capture: (document: D) => D,
  create: (
    source: ZlozEventStormingC4Source<D>,
    options?: ZlozEventStormingC4ConversionOptions,
  ) => ZlozEventStormingC4ConversionPlan<D>,
): ZlozEventStormingC4Conversion<D, V> {
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
    value.version !== version ||
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
  const plan = create(
    {
      document: decode(value.source.document),
      sessionId: value.source.sessionId,
      revision: value.source.revision,
    },
    value.options,
  );
  if (plan.type !== 'reviewable' || plan.provenance.document.snapshot.viewport === undefined)
    return invalidReceipt();
  if (version === 2 && plan.provenance.revision >= Number.MAX_SAFE_INTEGER) return invalidReceipt();
  const target = convertedDocument(plan, capture);
  if (!historyValueEqual(decode(value.document), target)) return invalidReceipt();
  return receipt(plan, target, version);
}
function captureReceipt(value: ReceiptFields): ZlozEventStormingC4Conversion {
  return captureReceiptFor(
    value,
    1,
    receiptDocument,
    captureModelDocument,
    createEventStormingC4ConversionPlan,
  );
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

export type ZlozEventStormingC4ConversionV2 = ZlozEventStormingC4Conversion<ZlozModelDocumentV2, 2>;
export type ZlozEventStormingC4ApplyResultV2 = ZlozEventStormingC4ApplyResult<
  ZlozModelDocumentV2,
  2
>;
export type ZlozEventStormingC4ApplyOptionsV2 =
  ZlozEventStormingC4ApplyOptions<ZlozModelDocumentV2>;
export function applyEventStormingC4Conversion(
  editor: EditorState,
  source: ZlozEventStormingC4Source,
  options: ZlozEventStormingC4ApplyOptions,
): ZlozEventStormingC4ApplyResult {
  return applyConversion(
    editor,
    source,
    options,
    resolveEventStormingC4ConversionConsent,
    captureModelDocument,
    1,
  );
}
export function applyEventStormingC4ConversionV2(
  editor: EditorState,
  source: ZlozEventStormingC4Source<ZlozModelDocumentV2>,
  options: ZlozEventStormingC4ApplyOptionsV2,
): ZlozEventStormingC4ApplyResultV2 {
  return applyConversion(
    editor,
    source,
    options,
    resolveEventStormingC4ConversionConsentV2,
    captureModelDocumentV2,
    2,
  );
}
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Receipt decoding owns raw data and validates its full versioned schema before publication.
function captureReceiptV2(input: unknown): ZlozEventStormingC4ConversionV2 {
  const value = ownedData(input);
  if (!receiptRecord(value)) return invalidReceipt();
  return captureReceiptFor(
    value,
    2,
    (document) =>
      parseModelDocumentV2(JSON.stringify({ format: 'foldkit-zloz-model', version: 2, document })),
    captureModelDocumentV2,
    createEventStormingC4ConversionPlanV2,
  );
}
export function serializeEventStormingC4ConversionV2(
  conversion: ZlozEventStormingC4ConversionV2,
): string {
  const text = JSON.stringify(captureReceiptV2(conversion));
  readPortableEvidenceJson(text);
  return text;
}
/** Strict bounded v2 evidence reopening. Recomputes mapping and exact complete target; never applies. */
export function parseEventStormingC4ConversionV2(text: string): ZlozEventStormingC4ConversionV2 {
  return captureReceiptV2(readPortableEvidenceJson(text));
}

export type ZlozEventStormingC4ApplyPolicyV2 = ZlozEventStormingC4ApplyPolicy<ZlozModelDocumentV2>;
