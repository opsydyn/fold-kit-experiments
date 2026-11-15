import type { ZlozNodeArchitecture } from './architecture';
import {
  previewEventStormingC4Mapping,
  previewEventStormingC4MappingV2,
  type ZlozEventStormingC4Source,
  type ZlozEventStormingC4MappingOptions,
  type ZlozEventStormingC4Preview,
  type ZlozEventStormingC4NodePreview,
  type ZlozEventStormingC4EdgePreview,
  type ZlozEventStormingC4Disclosure,
} from './event-storming-c4-preview';
import { projectEventStormingC4Graph } from './event-storming-c4-projection';
import { validateGraphForConnectionMode, ZlozError } from './graph';
import type { ZlozModelDocument } from './model-document';
import { captureModelDocumentV2, type ZlozModelDocumentV2 } from './model-document-v2';
import type { ZlozNode } from './types';

/** Root is diagram placement, not a claim about ownership outside the diagram. */
export type ZlozEventStormingC4Placement =
  | Readonly<{ type: 'root' }>
  | Readonly<{ type: 'organization' }>
  | Readonly<{ type: 'contained'; parentId: string }>;
export type ZlozEventStormingC4MembershipChoice = Readonly<{
  nodeId: string;
  placement: ZlozEventStormingC4Placement;
}>;
export type ZlozEventStormingC4ConversionOptions = Readonly<{
  mappings?: ZlozEventStormingC4MappingOptions;
  memberships?: readonly ZlozEventStormingC4MembershipChoice[];
}>;
/** Null means authored absence, including an absent expansion setting rather than false. */
export type ZlozEventStormingC4MembershipState = Readonly<{
  parentId: string | null;
  extent: 'parent' | null;
  expandParent: boolean | null;
}>;
export type ZlozEventStormingC4MembershipCode =
  | 'choice-required'
  | 'organization-parent-required'
  | 'c4-parent-requires-containment'
  | 'parent-missing'
  | 'parent-not-c4-boundary'
  | 'child-not-c4'
  | 'incompatible-roles'
  | 'cycle';
export type ZlozEventStormingC4MembershipDecision = Readonly<{
  nodeId: string;
  before: ZlozEventStormingC4MembershipState;
  reason: string;
}> &
  (
    | Readonly<{ type: 'unresolved'; code: 'choice-required' }>
    | Readonly<{
        type: 'blocked';
        code: Exclude<ZlozEventStormingC4MembershipCode, 'choice-required'>;
        placement: ZlozEventStormingC4Placement;
      }>
    | Readonly<{
        type: 'resolved';
        placement: ZlozEventStormingC4Placement;
        after: ZlozEventStormingC4MembershipState;
      }>
  );
export type ZlozEventStormingC4ConversionBlocker = Readonly<{ id: string; reason: string }> &
  (
    | Readonly<{ kind: 'node'; code: 'ambiguous' | 'unmapped' }>
    | Readonly<{ kind: 'edge'; code: 'unmapped' | 'endpoint-not-c4' }>
    | Readonly<{ kind: 'membership'; code: ZlozEventStormingC4MembershipCode }>
  );
export type ZlozEventStormingC4ConversionDisclosure = Readonly<{
  kind: 'node' | 'edge';
  id: string;
  reason: string;
  code:
    | Exclude<ZlozEventStormingC4Disclosure['code'], 'membership-not-c4-containment'>
    | 'membership-replaced'
    | 'parent-constraints-removed'
    | 'containment-declared';
}>;
/** Complete same-ID replacements and reviewed membership edits, not executable editor events. */
export type ZlozEventStormingC4ConversionChanges = Readonly<{
  nodes: readonly Extract<ZlozEventStormingC4NodePreview, { type: 'proposed' }>[];
  edges: readonly Extract<ZlozEventStormingC4EdgePreview, { type: 'proposed' }>[];
  memberships: readonly Extract<ZlozEventStormingC4MembershipDecision, { type: 'resolved' }>[];
}>;
export type ZlozEventStormingC4ConversionPlan<D extends ZlozModelDocument = ZlozModelDocument> =
  Readonly<{
    /** Exact-content identity, not a credential/hash. Contains source data: never log or put in the DOM. */
    key: string;
    provenance: ZlozEventStormingC4Source<D>;
    mappings: ZlozEventStormingC4Preview['choices'];
    membershipChoices: readonly ZlozEventStormingC4MembershipChoice[];
    preview: ZlozEventStormingC4Preview<D>;
    memberships: readonly ZlozEventStormingC4MembershipDecision[];
    disclosures: readonly ZlozEventStormingC4ConversionDisclosure[];
  }> &
    (
      | Readonly<{ type: 'blocked'; blockers: readonly ZlozEventStormingC4ConversionBlocker[] }>
      | Readonly<{ type: 'reviewable'; changes: ZlozEventStormingC4ConversionChanges }>
      | Readonly<{ type: 'unchanged' }>
    );
/** Host-recorded affirmative review of every loss in this exact plan; not human identity or Apply permission. */
export type ZlozEventStormingC4LossConsent = Readonly<{ planKey: string; accepted: true }>;
export type ZlozEventStormingC4ConversionConsentDecision<
  D extends ZlozModelDocument = ZlozModelDocument,
> =
  | Readonly<{
      type: 'blocked';
      plan: Extract<ZlozEventStormingC4ConversionPlan<D>, { type: 'blocked' }>;
    }>
  | Readonly<{
      type: 'unchanged';
      plan: Extract<ZlozEventStormingC4ConversionPlan<D>, { type: 'unchanged' }>;
    }>
  | Readonly<{
      type: 'consent-required';
      plan: Extract<ZlozEventStormingC4ConversionPlan<D>, { type: 'reviewable' }>;
      reason: string;
    }>
  | Readonly<{
      type: 'consented';
      plan: Extract<ZlozEventStormingC4ConversionPlan<D>, { type: 'reviewable' }>;
    }>;

type ConversionFields = Readonly<{
  mappings?: unknown;
  memberships?: unknown;
  nodeId?: unknown;
  placement?: unknown;
  type?: unknown;
  parentId?: unknown;
}>;
function record(value: unknown): value is ConversionFields {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function fields(value: ConversionFields, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function validParentId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function invalid(reason: string): never {
  throw new ZlozError('invalid-edit', reason);
}
function freeze<T>(value: T): T {
  if ((Array.isArray(value) || record(value)) && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function membership(node: ZlozNode): ZlozEventStormingC4MembershipState {
  return {
    parentId: node.parentId ?? null,
    extent: node.extent ?? null,
    expandParent: node.expandParent ?? null,
  };
}
function different(
  a: ZlozEventStormingC4MembershipState,
  b: ZlozEventStormingC4MembershipState,
): boolean {
  return a.parentId !== b.parentId || a.extent !== b.extent || a.expandParent !== b.expandParent;
}
/**
 * Session-only review planning. No target graph, Apply event or edit authority is returned. A mapped
 * element and every direct member of a reinterpreted lane require explicit placement. Declared C4
 * containment checks local role/kind/cycle compatibility, not pixel enclosure or global correctness.
 * Unresolved intent returns blockers without a partial change list. Input errors throw ZlozError.
 */
function createPlan<D extends ZlozModelDocument>(
  source: ZlozEventStormingC4Source<D>,
  options: ZlozEventStormingC4ConversionOptions,
  previewMapping: (
    source: ZlozEventStormingC4Source<D>,
    options?: ZlozEventStormingC4MappingOptions,
  ) => ZlozEventStormingC4Preview<D>,
): ZlozEventStormingC4ConversionPlan<D> {
  if (
    !record(options) ||
    !fields(options, ['mappings', 'memberships']) ||
    (options.memberships !== undefined && !Array.isArray(options.memberships))
  )
    invalid('C4 conversion options require mappings and a membership choice array.');
  const preview = previewMapping(source, options.mappings);
  const graph = preview.provenance.document.snapshot.graph;
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const proposed = new Map(
    preview.nodes.filter((node) => node.type === 'proposed').map((node) => [node.nodeId, node]),
  );
  const boundaries = new Set(
    graph.nodes
      .filter((node) => node.kind === 'group' && proposed.has(node.id))
      .map((node) => node.id),
  );
  const affected = graph.nodes.filter(
    (node) =>
      proposed.has(node.id) || (node.parentId !== undefined && boundaries.has(node.parentId)),
  );
  const affectedIds = new Set(affected.map((node) => node.id));
  const choices = new Map<string, ZlozEventStormingC4Placement>();
  const authored: readonly ZlozEventStormingC4MembershipChoice[] = options.memberships ?? [];
  for (const choice of authored) {
    if (
      !record(choice) ||
      !fields(choice, ['nodeId', 'placement']) ||
      !affectedIds.has(choice.nodeId) ||
      choices.has(choice.nodeId)
    )
      invalid('Membership choices require unique affected node IDs.');
    const p = choice.placement;
    if (!record(p)) invalid('Membership choices require an explicit placement.');
    switch (p.type) {
      case 'root':
      case 'organization':
        if (!fields(p, ['type']))
          invalid('Root and organization placements accept only their type.');
        choices.set(choice.nodeId, { type: p.type });
        break;
      case 'contained':
        if (!fields(p, ['type', 'parentId']) || !validParentId(p.parentId))
          invalid('Contained placement requires a nonempty parent ID.');
        choices.set(choice.nodeId, { type: 'contained', parentId: p.parentId });
        break;
      default:
        invalid('Unknown C4 placement type.');
    }
  }
  const architecture = (id: string): ZlozNodeArchitecture | undefined =>
    proposed.get(id)?.architecture ?? nodes.get(id)?.architecture;
  const intended = new Map(graph.nodes.map((node) => [node.id, node.parentId]));
  for (const [id, placement] of choices) {
    if (placement.type === 'root') intended.set(id, undefined);
    else if (placement.type === 'contained') intended.set(id, placement.parentId);
  }
  const cycle = (id: string): boolean => {
    const visited = new Set<string>();
    let at: string | undefined = id;
    while (at !== undefined) {
      if (visited.has(at)) return true;
      visited.add(at);
      at = intended.get(at);
    }
    return false;
  };
  const memberships: ZlozEventStormingC4MembershipDecision[] = affected.map((node) => {
    const before = membership(node),
      placement = choices.get(node.id);
    const base = { nodeId: node.id, before };
    if (!placement)
      return {
        ...base,
        type: 'unresolved',
        code: 'choice-required',
        reason:
          'Explicitly choose root placement, retained organizational membership or compatible C4 containment.',
      };
    const blocked = (
      code: Exclude<ZlozEventStormingC4MembershipCode, 'choice-required'>,
      reason: string,
    ): ZlozEventStormingC4MembershipDecision => ({
      ...base,
      type: 'blocked',
      code,
      reason,
      placement,
    });
    if (cycle(node.id))
      return blocked('cycle', 'The combined placement choices would create a parent cycle.');
    if (placement.type === 'root')
      return {
        ...base,
        type: 'resolved',
        placement,
        after: { parentId: null, extent: null, expandParent: null },
        reason:
          'Explicit diagram root; world coordinates stay unchanged and parent-dependent settings are removed. No ownership outside the diagram is inferred.',
      };
    if (placement.type === 'organization') {
      if (before.parentId === null)
        return blocked(
          'organization-parent-required',
          'There is no existing organizational parent to retain; choose root or explicit containment.',
        );
      if (architecture(before.parentId)?.family === 'c4')
        return blocked(
          'c4-parent-requires-containment',
          'A C4 boundary cannot silently retain organizational members. Explicitly declare compatible containment or detach this member.',
        );
      return {
        ...base,
        type: 'resolved',
        placement,
        after: { ...before },
        reason:
          'Existing non-C4 grouping is explicitly retained as organization only, not C4 containment.',
      };
    }
    const parent = nodes.get(placement.parentId),
      parentArchitecture = architecture(placement.parentId),
      childArchitecture = architecture(node.id);
    if (!parent)
      return blocked('parent-missing', 'The chosen parent does not exist in the captured source.');
    if (
      parent.kind !== 'group' ||
      parentArchitecture?.family !== 'c4' ||
      !['software-system', 'container'].includes(parentArchitecture.role)
    )
      return blocked(
        'parent-not-c4-boundary',
        'Declared containment requires an existing group with proposed or authored C4 software-system/container meaning.',
      );
    if (childArchitecture?.family !== 'c4')
      return blocked(
        'child-not-c4',
        'Retained workshop or non-C4 members cannot become runtime elements implicitly; explicitly interpret them or detach them.',
      );
    if (
      !(
        (parentArchitecture.role === 'software-system' && childArchitecture.role === 'container') ||
        (parentArchitecture.role === 'container' && childArchitecture.role === 'component')
      )
    )
      return blocked(
        'incompatible-roles',
        'Declared C4 containment supports containers inside software-system groups and components inside container groups.',
      );
    return {
      ...base,
      type: 'resolved',
      placement,
      after: { ...before, parentId: parent.id },
      reason:
        'Explicit local C4 containment; role/kind and combined parent-cycle checks pass. Geometry is not moved or resized and global ownership correctness is not implied.',
    };
  });
  const disclosures: ZlozEventStormingC4ConversionDisclosure[] = preview.disclosures.flatMap(
    (finding) =>
      finding.code === 'membership-not-c4-containment' ? [] : [{ ...finding, code: finding.code }],
  );
  for (const decision of memberships) {
    if (decision.type !== 'resolved') continue;
    const add = (code: ZlozEventStormingC4ConversionDisclosure['code'], reason: string) =>
      disclosures.push({ kind: 'node', id: decision.nodeId, code, reason });
    if (decision.before.parentId !== null && decision.before.parentId !== decision.after.parentId)
      add(
        'membership-replaced',
        'The authored parent membership would be removed or replaced; world coordinates and original membership remain in provenance.',
      );
    if (
      decision.placement.type === 'root' &&
      (decision.before.extent !== null || decision.before.expandParent !== null)
    )
      add(
        'parent-constraints-removed',
        'Root placement would remove authored parent-dependent extent/expansion settings; source settings remain in provenance.',
      );
    if (decision.placement.type === 'contained')
      add(
        'containment-declared',
        'Spatial grouping would be explicitly interpreted as C4 containment, not lossless preservation of workshop ownership. The original remains in provenance.',
      );
  }
  const membershipChoices = [...choices].map(([nodeId, placement]) => ({ nodeId, placement }));
  const provenance = preview.provenance,
    mappings = preview.choices;
  const key = JSON.stringify({
    provenance,
    mappings,
    membershipChoices,
    preview,
    memberships,
    disclosures,
  });
  const base = { key, provenance, mappings, membershipChoices, preview, memberships, disclosures };
  const blockers: ZlozEventStormingC4ConversionBlocker[] = [
    ...preview.nodes.flatMap((node) =>
      node.type === 'ambiguous' || node.type === 'unmapped'
        ? [{ kind: 'node' as const, id: node.nodeId, code: node.type, reason: node.reason }]
        : [],
    ),
    ...preview.edges.flatMap((edge) =>
      edge.type === 'unmapped' || edge.type === 'blocked'
        ? [
            {
              kind: 'edge' as const,
              id: edge.edgeId,
              code: edge.type === 'blocked' ? edge.code : ('unmapped' as const),
              reason: edge.reason,
            },
          ]
        : [],
    ),
    ...memberships.flatMap((decision) =>
      decision.type === 'resolved'
        ? []
        : [
            {
              kind: 'membership' as const,
              id: decision.nodeId,
              code: decision.code,
              reason: decision.reason,
            },
          ],
    ),
  ];
  if (blockers.length) return freeze({ ...base, type: 'blocked', blockers });
  const resolved = memberships.filter((decision) => decision.type === 'resolved');
  const changes = {
    nodes: preview.nodes.filter((node) => node.type === 'proposed'),
    edges: preview.edges.filter((edge) => edge.type === 'proposed'),
    memberships: resolved.filter(
      (decision) =>
        different(decision.before, decision.after) || decision.placement.type === 'contained',
    ),
  };
  const snapshot = provenance.document.snapshot;
  validateGraphForConnectionMode(
    projectEventStormingC4Graph(graph, changes),
    'connectionMode' in snapshot &&
      (snapshot.connectionMode === 'strict' || snapshot.connectionMode === 'loose')
      ? snapshot.connectionMode
      : 'strict',
  );
  return freeze(
    changes.nodes.length || changes.edges.length || changes.memberships.length
      ? { ...base, type: 'reviewable', changes }
      : { ...base, type: 'unchanged' },
  );
}
/** Rebuild the exact current plan before checking consent. Consent is review data, never Apply authority. Null revokes it. */
function resolveConsent<D extends ZlozModelDocument>(
  plan: ZlozEventStormingC4ConversionPlan<D>,
  consent: ZlozEventStormingC4LossConsent | null,
): ZlozEventStormingC4ConversionConsentDecision<D> {
  if (plan.type === 'blocked') return { type: 'blocked', plan };
  if (plan.type === 'unchanged') return { type: 'unchanged', plan };
  if (consent?.accepted !== true || consent.planKey !== plan.key)
    return {
      type: 'consent-required',
      plan,
      reason:
        'Review the current source, explicit mappings, every placement and all prospective losses, then explicitly acknowledge this exact plan.',
    };
  return { type: 'consented', plan };
}

export function createEventStormingC4ConversionPlan(
  source: ZlozEventStormingC4Source,
  options: ZlozEventStormingC4ConversionOptions = {},
): ZlozEventStormingC4ConversionPlan {
  return createPlan(source, options, previewEventStormingC4Mapping);
}
export function createEventStormingC4ConversionPlanV2(
  source: ZlozEventStormingC4Source<ZlozModelDocumentV2>,
  options: ZlozEventStormingC4ConversionOptions = {},
): ZlozEventStormingC4ConversionPlan<ZlozModelDocumentV2> {
  return createPlan(source, options, previewEventStormingC4MappingV2);
}
export function resolveEventStormingC4ConversionConsent(
  source: ZlozEventStormingC4Source,
  options: ZlozEventStormingC4ConversionOptions = {},
  consent: ZlozEventStormingC4LossConsent | null = null,
): ZlozEventStormingC4ConversionConsentDecision {
  return resolveConsent(createEventStormingC4ConversionPlan(source, options), consent);
}
export function resolveEventStormingC4ConversionConsentV2(
  source: ZlozEventStormingC4Source<ZlozModelDocumentV2>,
  options: ZlozEventStormingC4ConversionOptions = {},
  consent: ZlozEventStormingC4LossConsent | null = null,
): ZlozEventStormingC4ConversionConsentDecision<ZlozModelDocumentV2> {
  return resolveConsent(createEventStormingC4ConversionPlanV2(source, options), consent);
}

export type ZlozEventStormingC4ConversionPlanV2 =
  ZlozEventStormingC4ConversionPlan<ZlozModelDocumentV2>;
export type ZlozEventStormingC4ConversionConsentDecisionV2 =
  ZlozEventStormingC4ConversionConsentDecision<ZlozModelDocumentV2>;
