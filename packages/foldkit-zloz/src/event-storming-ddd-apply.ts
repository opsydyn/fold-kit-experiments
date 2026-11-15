import { isNodeArchitecture, isDddEdgeArchitecture, architectureNodePresets } from './architecture';
import { commitGraph } from './editor';
import {
  createEventStormingDddConversionPlan,
  createEventStormingDddConversionPlanV2,
  resolveEventStormingDddConversionConsent,
  resolveEventStormingDddConversionConsentV2,
  type ZlozEventStormingDddConversionConsentDecision,
  type ZlozEventStormingDddConversionPlan,
  type ZlozEventStormingDddConversionSource,
  type ZlozEventStormingDddLossConsent,
} from './event-storming-ddd-conversion-plan';
import type { ZlozEventStormingDddMappingOptions } from './event-storming-ddd-preview';
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
import type { EditorPolicy, EditorState, JsonValue } from './types';

type ReviewablePlan<D extends ZlozModelDocument = ZlozModelDocument> = Extract<
  ZlozEventStormingDddConversionPlan<D>,
  { type: 'reviewable' }
>;
/** Portable unsigned conversion receipt. Source provenance is separate from edition-fork ancestry. */
export type ZlozEventStormingDddConversion<
  D extends ZlozModelDocument = ZlozModelDocument,
  V extends 1 | 2 = 1,
> = Readonly<{
  format: 'foldkit-zloz-ddd-conversion';
  version: V;
  source: ZlozEventStormingDddConversionSource<D>;
  mappings: ZlozEventStormingDddMappingOptions;
  lossesAccepted: true;
  document: D;
}>;
export type ZlozEventStormingDddApplyPolicy<D extends ZlozModelDocument = ZlozModelDocument> =
  EditorPolicy &
    Readonly<{
      /** Whole-transaction veto; inspect complete frozen source/target values before publication. */
      canApplyEventStormingDddConversion?: (
        plan: Extract<ZlozEventStormingDddConversionPlan<D>, { type: 'reviewable' }>,
        target: D,
      ) => string | null;
    }>;
export type ZlozEventStormingDddApplyOptions<D extends ZlozModelDocument = ZlozModelDocument> =
  Readonly<{
    mappings?: ZlozEventStormingDddMappingOptions;
    consent: ZlozEventStormingDddLossConsent | null;
    policy?: ZlozEventStormingDddApplyPolicy<D>;
    /** Current host-only busy condition (imports, layout, external drafts), not a cached permission. */
    blockedReason?: string | null;
  }>;
export type ZlozEventStormingDddApplyResult<
  D extends ZlozModelDocument = ZlozModelDocument,
  V extends 1 | 2 = 1,
> =
  | Readonly<{
      type: 'applied';
      editor: EditorState;
      conversion: ZlozEventStormingDddConversion<D, V>;
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
  const nodes = new Map(plan.changes.nodes.map((change) => [change.nodeId, change.architecture]));
  const edges = new Map(plan.changes.edges.map((change) => [change.edgeId, change.architecture]));
  return capture({
    ...source,
    snapshot: {
      ...source.snapshot,
      graph: {
        nodes: source.snapshot.graph.nodes.map((node) =>
          nodes.has(node.id) ? { ...node, architecture: nodes.get(node.id) } : node,
        ),
        edges: source.snapshot.graph.edges.map((edge) =>
          edges.has(edge.id) ? { ...edge, architecture: edges.get(edge.id) } : edge,
        ),
      },
    },
  });
}
function receipt<D extends ZlozModelDocument, V extends 1 | 2>(
  plan: ReviewablePlan<D>,
  document: D,
  version: V,
): ZlozEventStormingDddConversion<D, V> {
  return Object.freeze({
    format: 'foldkit-zloz-ddd-conversion',
    version,
    source: plan.provenance,
    mappings: plan.mappings,
    lossesAccepted: true,
    document,
  });
}
const denial = (reason: string | null | undefined): string | null =>
  reason == null ? null : reason.trim() || 'DDD conversion is protected.';
/**
 * Synchronous atomic publication from the live editor/document/session. Never accepts a prepared
 * plan or imported receipt as authority. Source snapshot must include the exact live camera.
 * Pure host policies receive detached frozen values; granular hooks retain current-graph semantics.
 * Caller must publish the returned editor and retain the conversion receipt together, without an
 * intervening await. Storage, host scope authenticity and external busy conditions belong to host.
 */
function applyConversion<D extends ZlozModelDocument, V extends 1 | 2>(
  editor: EditorState,
  source: ZlozEventStormingDddConversionSource<D>,
  options: ZlozEventStormingDddApplyOptions<D>,
  resolve: (
    source: ZlozEventStormingDddConversionSource<D>,
    choices?: ZlozEventStormingDddMappingOptions,
    consent?: ZlozEventStormingDddLossConsent | null,
  ) => ZlozEventStormingDddConversionConsentDecision<D>,
  capture: (document: D) => D,
  version: V,
): ZlozEventStormingDddApplyResult<D, V> {
  const review = resolve(source, options.mappings, options.consent);
  const checked = review.plan.provenance;
  const block = (
    code: Extract<ZlozEventStormingDddApplyResult<D, V>, { type: 'blocked' }>['code'],
    reason: string,
  ): ZlozEventStormingDddApplyResult<D, V> => ({ type: 'blocked', editor, code, reason });
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
  const bulk = denial(policy.canApplyEventStormingDddConversion?.(plan, target));
  if (bulk !== null) return block('policy', bulk);
  const before = plan.provenance.document.snapshot.graph,
    after = target.snapshot.graph;
  for (const change of plan.changes.nodes) {
    const node = before.nodes.find((item) => item.id === change.nodeId),
      next = after.nodes.find((item) => item.id === change.nodeId);
    if (!node || !next) throw new ZlozError('invalid-edit', 'Conversion node identity changed.');
    const reason = denial(policy.canChangeNodeArchitecture?.(node, next, before));
    if (reason !== null) return block('policy', reason);
  }
  for (const change of plan.changes.edges) {
    const edge = before.edges.find((item) => item.id === change.edgeId),
      next = after.edges.find((item) => item.id === change.edgeId);
    if (!edge || !next) throw new ZlozError('invalid-edit', 'Conversion edge identity changed.');
    const reason = denial(policy.canChangeEdgeArchitecture?.(edge, next, before));
    if (reason !== null) return block('policy', reason);
  }
  const conversion = receipt(plan, target, version);
  if (version === 2) readPortableEvidenceJson(JSON.stringify(conversion));
  return { type: 'applied', editor: commitGraph(editor, target.snapshot.graph), conversion };
}

// Data-only receipt boundary. Domain invariants are rechecked by the existing plan/model contracts.
function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function fields(value: Record<string, JsonValue>, names: readonly string[]) {
  return Object.keys(value).every((key) => names.includes(key));
}
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isDddRole(value: unknown): value is string {
  return (
    isText(value) &&
    architectureNodePresets.some(
      (preset) => preset.architecture.family === 'ddd' && preset.architecture.role === value,
    )
  );
}
function isNodeChoice(
  value: unknown,
): value is NonNullable<ZlozEventStormingDddMappingOptions['nodes']>[number] {
  return (
    isRecord(value) &&
    fields(value, ['nodeId', 'architecture']) &&
    isText(value.nodeId) &&
    (value.architecture === null ||
      (isNodeArchitecture(value.architecture) && value.architecture.family === 'ddd'))
  );
}
function isEdgeChoice(
  value: unknown,
): value is NonNullable<ZlozEventStormingDddMappingOptions['edges']>[number] {
  return (
    isRecord(value) &&
    fields(value, ['edgeId', 'architecture']) &&
    isText(value.edgeId) &&
    (value.architecture === null || isDddEdgeArchitecture(value.architecture))
  );
}
function isMappings(value: unknown): value is ZlozEventStormingDddMappingOptions {
  return (
    isRecord(value) &&
    fields(value, ['nodes', 'edges', 'relationships']) &&
    (!('nodes' in value) || (Array.isArray(value.nodes) && value.nodes.every(isNodeChoice))) &&
    (!('edges' in value) || (Array.isArray(value.edges) && value.edges.every(isEdgeChoice))) &&
    (!('relationships' in value) ||
      (isRecord(value.relationships) &&
        fields(value.relationships, ['rules']) &&
        (!('rules' in value.relationships) ||
          (Array.isArray(value.relationships.rules) &&
            value.relationships.rules.every(
              (rule) =>
                isRecord(rule) &&
                fields(rule, ['architecture', 'sources', 'targets', 'label', 'direction']) &&
                isDddEdgeArchitecture(rule.architecture) &&
                isText(rule.label) &&
                Array.isArray(rule.sources) &&
                rule.sources.every(isDddRole) &&
                Array.isArray(rule.targets) &&
                rule.targets.every(isDddRole) &&
                (rule.direction === 'directed' || rule.direction === 'symmetric'),
            )))))
  );
}
function invalidReceipt(): never {
  throw new ZlozError('invalid-graph', 'Invalid or unsupported DDD conversion receipt.');
}
function decodeDocument(value: JsonValue | undefined): ZlozModelDocument {
  return parseModelDocument(
    JSON.stringify({ format: 'foldkit-zloz-model', version: 1, document: value }),
  );
}
function captureReceiptFor<D extends ZlozModelDocument, V extends 1 | 2>(
  value: JsonValue,
  version: V,
  decode: (value: JsonValue | undefined) => D,
  capture: (document: D) => D,
  create: (
    source: ZlozEventStormingDddConversionSource<D>,
    options?: ZlozEventStormingDddMappingOptions,
  ) => ZlozEventStormingDddConversionPlan<D>,
): ZlozEventStormingDddConversion<D, V> {
  if (
    !isRecord(value) ||
    !fields(value, ['format', 'version', 'source', 'mappings', 'lossesAccepted', 'document']) ||
    value.format !== 'foldkit-zloz-ddd-conversion' ||
    value.version !== version ||
    value.lossesAccepted !== true ||
    !isRecord(value.source) ||
    !fields(value.source, ['document', 'sessionId', 'revision']) ||
    !isText(value.source.sessionId) ||
    !isNumber(value.source.revision) ||
    !isMappings(value.mappings)
  )
    return invalidReceipt();
  const source = {
    document: decode(value.source.document),
    sessionId: value.source.sessionId,
    revision: value.source.revision,
  };
  const plan = create(source, value.mappings);
  if (plan.type !== 'reviewable' || plan.provenance.document.snapshot.viewport === undefined)
    return invalidReceipt();
  if (version === 2 && plan.provenance.revision >= Number.MAX_SAFE_INTEGER) return invalidReceipt();
  const target = convertedDocument(plan, capture);
  if (!historyValueEqual(decode(value.document), target)) return invalidReceipt();
  return receipt(plan, target, version);
}
function captureReceipt(value: JsonValue): ZlozEventStormingDddConversion {
  return captureReceiptFor(
    value,
    1,
    decodeDocument,
    captureModelDocument,
    createEventStormingDddConversionPlan,
  );
}
/** Export the entire receipt to retain before/after documents and the mapping contract. Model-only JSON omits conversion receipts. */
export function serializeEventStormingDddConversion(
  conversion: ZlozEventStormingDddConversion,
): string {
  if (!isRecord(conversion)) return invalidReceipt();
  return JSON.stringify(captureReceipt(conversion));
}
/** Strict independent v1 receipt envelope. Validates data, not authorship; importing never applies or authorizes edits. */
export function parseEventStormingDddConversion(json: string): ZlozEventStormingDddConversion {
  let value: unknown;
  // oxlint-disable-next-line linteffect/no-try-catch -- Dependency-free receipt JSON boundary translates native syntax errors.
  try {
    value = JSON.parse(json);
  } catch {
    return invalidReceipt();
  }
  if (!isRecord(value)) return invalidReceipt();
  return captureReceipt(value);
}

export type ZlozEventStormingDddConversionV2 = ZlozEventStormingDddConversion<
  ZlozModelDocumentV2,
  2
>;
export type ZlozEventStormingDddApplyResultV2 = ZlozEventStormingDddApplyResult<
  ZlozModelDocumentV2,
  2
>;
export type ZlozEventStormingDddApplyOptionsV2 =
  ZlozEventStormingDddApplyOptions<ZlozModelDocumentV2>;
export function applyEventStormingDddConversion(
  editor: EditorState,
  source: ZlozEventStormingDddConversionSource,
  options: ZlozEventStormingDddApplyOptions,
): ZlozEventStormingDddApplyResult {
  return applyConversion(
    editor,
    source,
    options,
    resolveEventStormingDddConversionConsent,
    captureModelDocument,
    1,
  );
}
export function applyEventStormingDddConversionV2(
  editor: EditorState,
  source: ZlozEventStormingDddConversionSource<ZlozModelDocumentV2>,
  options: ZlozEventStormingDddApplyOptionsV2,
): ZlozEventStormingDddApplyResultV2 {
  return applyConversion(
    editor,
    source,
    options,
    resolveEventStormingDddConversionConsentV2,
    captureModelDocumentV2,
    2,
  );
}
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Receipt decoding owns raw data and validates its full versioned schema before publication.
function captureReceiptV2(input: unknown): ZlozEventStormingDddConversionV2 {
  const value = ownedData(input);
  return captureReceiptFor(
    value,
    2,
    (document) =>
      parseModelDocumentV2(JSON.stringify({ format: 'foldkit-zloz-model', version: 2, document })),
    captureModelDocumentV2,
    createEventStormingDddConversionPlanV2,
  );
}
export function serializeEventStormingDddConversionV2(
  conversion: ZlozEventStormingDddConversionV2,
): string {
  const text = JSON.stringify(captureReceiptV2(conversion));
  readPortableEvidenceJson(text);
  return text;
}
/** Strict bounded v2 evidence reopening. Recomputes mapping and exact complete target; never applies. */
export function parseEventStormingDddConversionV2(text: string): ZlozEventStormingDddConversionV2 {
  return captureReceiptV2(readPortableEvidenceJson(text));
}

export type ZlozEventStormingDddApplyPolicyV2 =
  ZlozEventStormingDddApplyPolicy<ZlozModelDocumentV2>;
