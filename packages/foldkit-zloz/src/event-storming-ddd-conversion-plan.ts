import { copyEdgeArchitecture, type DddEdgeArchitecture } from './architecture';
import { checkedDddRelationshipRules } from './ddd-relationships';
import {
  previewEventStormingDddMapping,
  previewEventStormingDddMappingV2,
  previewEventStormingDddMappingV3,
  type ZlozEventStormingDddMappingOptions,
  type ZlozEventStormingDddNodePreview,
  type ZlozEventStormingDddEdgePreview,
  type ZlozEventStormingDddPreview,
} from './event-storming-ddd-preview';
import { ZlozError } from './graph';
import { captureModelDocument, type ZlozModelDocument } from './model-document';
import { captureModelDocumentV2, type ZlozModelDocumentV2 } from './model-document-v2';
import { captureModelDocumentV3, type ZlozModelDocumentV3 } from './model-document-v3';

/** Host-owned live scope; a new source session must not reuse an earlier session ID. */
export type ZlozEventStormingDddConversionSource<D extends ZlozModelDocument = ZlozModelDocument> =
  Readonly<{
    document: D;
    sessionId: string;
    revision: number;
  }>;
export type ZlozEventStormingDddConversionBlocker = Readonly<{ id: string; reason: string }> &
  (
    | Readonly<{ kind: 'node'; decision: 'ambiguous' | 'unmapped' }>
    | Readonly<{ kind: 'edge'; decision: 'unmapped' | 'blocked' }>
  );
/** Same-ID descriptor replacements only; these are review data, not editor events. */
export type ZlozEventStormingDddConversionChanges = Readonly<{
  nodes: readonly Extract<ZlozEventStormingDddNodePreview, { type: 'proposed' }>[];
  edges: readonly Extract<ZlozEventStormingDddEdgePreview, { type: 'proposed' }>[];
}>;
export type ZlozEventStormingDddConversionPlan<D extends ZlozModelDocument = ZlozModelDocument> =
  Readonly<{
    /** Exact-content review identity, not a hash or credential. Contains source data; do not log or put in the DOM. */
    key: string;
    /** Detached complete source, including camera, editions and fork ancestry. Not a new model origin. */
    provenance: ZlozEventStormingDddConversionSource<D>;
    /** Detached explicit choices plus the effective DDD catalogue, including defaults. */
    mappings: ZlozEventStormingDddMappingOptions;
    preview: ZlozEventStormingDddPreview;
  }> &
    (
      | Readonly<{ type: 'blocked'; blockers: readonly ZlozEventStormingDddConversionBlocker[] }>
      | Readonly<{ type: 'reviewable'; changes: ZlozEventStormingDddConversionChanges }>
      | Readonly<{ type: 'unchanged' }>
    );
/** Host-recorded affirmative acceptance of every prospective loss in this exact plan. Not proof of a human actor or edit permission. */
export type ZlozEventStormingDddLossConsent = Readonly<{ planKey: string; accepted: true }>;
export type ZlozEventStormingDddConversionConsentDecision<
  D extends ZlozModelDocument = ZlozModelDocument,
> =
  | Readonly<{
      type: 'blocked';
      plan: Extract<ZlozEventStormingDddConversionPlan<D>, { type: 'blocked' }>;
    }>
  | Readonly<{
      type: 'unchanged';
      plan: Extract<ZlozEventStormingDddConversionPlan<D>, { type: 'unchanged' }>;
    }>
  | Readonly<{
      type: 'consent-required';
      plan: Extract<ZlozEventStormingDddConversionPlan<D>, { type: 'reviewable' }>;
      reason: string;
    }>
  | Readonly<{
      type: 'consented';
      plan: Extract<ZlozEventStormingDddConversionPlan<D>, { type: 'reviewable' }>;
    }>;

function copyDddArchitecture(value: DddEdgeArchitecture): DddEdgeArchitecture {
  const copied = copyEdgeArchitecture(value);
  if (copied.family !== 'ddd')
    throw new ZlozError('invalid-edit', 'Expected a validated DDD descriptor.');
  return copied;
}
function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
function hasConversionScope(
  value: unknown,
): value is Pick<ZlozEventStormingDddConversionSource, 'sessionId' | 'revision'> {
  return (
    isObject(value) &&
    'sessionId' in value &&
    typeof value.sessionId === 'string' &&
    value.sessionId.trim().length > 0 &&
    'revision' in value &&
    typeof value.revision === 'number' &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0
  );
}
function freeze<T>(value: T): T {
  if (isObject(value) && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
/**
 * Build a session-only review plan, never a converted graph or Apply event. Invalid input throws;
 * unresolved intent returns blockers with no partial change list. Retention must be explicit for
 * ambiguous/unmapped workshop meaning. Retained causal links make no compatibility claim.
 */
function createPlan<D extends ZlozModelDocument>(
  source: ZlozEventStormingDddConversionSource<D>,
  options: ZlozEventStormingDddMappingOptions,
  capture: (document: D) => D,
  previewMapping: (
    document: D,
    options: ZlozEventStormingDddMappingOptions,
  ) => ZlozEventStormingDddPreview,
): ZlozEventStormingDddConversionPlan<D> {
  if (!hasConversionScope(source))
    throw new ZlozError(
      'invalid-edit',
      'Conversion plans require a nonempty source session ID and nonnegative safe integer revision.',
    );
  const provenance = {
    document: capture(source.document),
    sessionId: source.sessionId,
    revision: source.revision,
  };
  const preview = previewMapping(provenance.document, options);
  // Preview validates choices before any copying. Only data belonging to the published catalogue contract is retained.
  const mappings: ZlozEventStormingDddMappingOptions = {
    nodes: (options.nodes ?? []).map((choice) => ({
      nodeId: choice.nodeId,
      architecture: choice.architecture === null ? null : { ...choice.architecture },
    })),
    edges: (options.edges ?? []).map((choice) => ({
      edgeId: choice.edgeId,
      architecture: choice.architecture === null ? null : copyDddArchitecture(choice.architecture),
    })),
    relationships: {
      rules: checkedDddRelationshipRules(options.relationships ?? {}).map((rule) => ({
        architecture: copyDddArchitecture(rule.architecture),
        sources: [...rule.sources],
        targets: [...rule.targets],
        label: rule.label,
        direction: rule.direction,
      })),
    },
  };
  const key = JSON.stringify({ provenance, mappings, preview });
  const base = { key, provenance, mappings, preview };
  const blockers: ZlozEventStormingDddConversionBlocker[] = [
    ...preview.nodes.flatMap((node) =>
      node.type === 'ambiguous' || node.type === 'unmapped'
        ? [{ kind: 'node' as const, id: node.nodeId, decision: node.type, reason: node.reason }]
        : [],
    ),
    ...preview.edges.flatMap((edge) =>
      edge.type === 'unmapped' || edge.type === 'blocked'
        ? [{ kind: 'edge' as const, id: edge.edgeId, decision: edge.type, reason: edge.reason }]
        : [],
    ),
  ];
  if (blockers.length) return freeze({ ...base, type: 'blocked', blockers });
  const changes = {
    nodes: preview.nodes.filter((node) => node.type === 'proposed'),
    edges: preview.edges.filter((edge) => edge.type === 'proposed'),
  };
  if (!changes.nodes.length && !changes.edges.length) return freeze({ ...base, type: 'unchanged' });
  return freeze({ ...base, type: 'reviewable', changes });
}

/**
 * Rebuild from current source/choices/conventions before checking all-loss acceptance. Passing an
 * old plan is deliberately unsupported. Consented does not authorize Apply: the future transaction
 * must independently recheck live model/session/revision, policy, lifecycle, consent and provenance.
 * Null revokes consent. No state, graph, Undo, document or edition is written here.
 */
function resolveConsent<D extends ZlozModelDocument>(
  plan: ZlozEventStormingDddConversionPlan<D>,
  consent: ZlozEventStormingDddLossConsent | null,
): ZlozEventStormingDddConversionConsentDecision<D> {
  if (plan.type === 'blocked') return { type: 'blocked', plan };
  if (plan.type === 'unchanged') return { type: 'unchanged', plan };
  if (consent?.accepted !== true || consent.planKey !== plan.key)
    return {
      type: 'consent-required',
      plan,
      reason:
        'Review the current source, mappings and all prospective losses, then explicitly accept this exact plan.',
    };
  return { type: 'consented', plan };
}

export function createEventStormingDddConversionPlan(
  source: ZlozEventStormingDddConversionSource,
  options: ZlozEventStormingDddMappingOptions = {},
): ZlozEventStormingDddConversionPlan {
  return createPlan(source, options, captureModelDocument, (document, choices) =>
    previewEventStormingDddMapping(document.snapshot.graph, choices),
  );
}
export function createEventStormingDddConversionPlanV2(
  source: ZlozEventStormingDddConversionSource<ZlozModelDocumentV2>,
  options: ZlozEventStormingDddMappingOptions = {},
): ZlozEventStormingDddConversionPlan<ZlozModelDocumentV2> {
  return createPlan(source, options, captureModelDocumentV2, (document, choices) =>
    previewEventStormingDddMappingV2(document.snapshot, choices),
  );
}
export function resolveEventStormingDddConversionConsent(
  source: ZlozEventStormingDddConversionSource,
  options: ZlozEventStormingDddMappingOptions = {},
  consent: ZlozEventStormingDddLossConsent | null = null,
): ZlozEventStormingDddConversionConsentDecision {
  return resolveConsent(createEventStormingDddConversionPlan(source, options), consent);
}
export function resolveEventStormingDddConversionConsentV2(
  source: ZlozEventStormingDddConversionSource<ZlozModelDocumentV2>,
  options: ZlozEventStormingDddMappingOptions = {},
  consent: ZlozEventStormingDddLossConsent | null = null,
): ZlozEventStormingDddConversionConsentDecision<ZlozModelDocumentV2> {
  return resolveConsent(createEventStormingDddConversionPlanV2(source, options), consent);
}

export type ZlozEventStormingDddConversionPlanV2 =
  ZlozEventStormingDddConversionPlan<ZlozModelDocumentV2>;
export type ZlozEventStormingDddConversionConsentDecisionV2 =
  ZlozEventStormingDddConversionConsentDecision<ZlozModelDocumentV2>;
export type ZlozEventStormingDddConversionSourceV2 =
  ZlozEventStormingDddConversionSource<ZlozModelDocumentV2>;

export type ZlozEventStormingDddConversionSourceV3 =
  ZlozEventStormingDddConversionSource<ZlozModelDocumentV3>;
export type ZlozEventStormingDddConversionPlanV3 =
  ZlozEventStormingDddConversionPlan<ZlozModelDocumentV3>;
export type ZlozEventStormingDddConversionConsentDecisionV3 =
  ZlozEventStormingDddConversionConsentDecision<ZlozModelDocumentV3>;
export function createEventStormingDddConversionPlanV3(
  source: ZlozEventStormingDddConversionSource<ZlozModelDocumentV3>,
  options: ZlozEventStormingDddMappingOptions = {},
): ZlozEventStormingDddConversionPlanV3 {
  return createPlan(source, options, captureModelDocumentV3, (document, choices) =>
    previewEventStormingDddMappingV3(document.snapshot, choices),
  );
}
export function resolveEventStormingDddConversionConsentV3(
  source: ZlozEventStormingDddConversionSource<ZlozModelDocumentV3>,
  options: ZlozEventStormingDddMappingOptions = {},
  consent: ZlozEventStormingDddLossConsent | null = null,
): ZlozEventStormingDddConversionConsentDecisionV3 {
  return resolveConsent(createEventStormingDddConversionPlanV3(source, options), consent);
}
