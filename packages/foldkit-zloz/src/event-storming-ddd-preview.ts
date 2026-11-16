import {
  copyEdgeArchitecture,
  isDddEdgeArchitecture,
  isNodeArchitecture,
  validNodeArchitectureFields,
  type DddEdgeArchitecture,
  type DddNodeArchitecture,
  type EventStormingNodeArchitecture,
  type ZlozEdgeArchitecture,
} from './architecture';
import {
  parseConnectionDocument,
  serializeConnectionDocument,
  type ZlozConnectionDocument,
} from './connection-document';
import type { ZlozConnectionMode } from './connection-mode';
import {
  checkedDddRelationshipRules,
  resolveDddRelationship,
  type ZlozDddRelationshipDecision,
  type ZlozDddRelationshipOptions,
} from './ddd-relationships';
import { validateGraphForConnectionMode, ZlozError } from './graph';
import { captureGroupDocumentV3, type ZlozGroupDocumentV3 } from './group-document-v3';
import type { ZlozGraph } from './types';

/** Explicit workshop choices, not editor events or permission to convert. Null retains source meaning. */
export type ZlozEventStormingDddMappingOptions = Readonly<{
  nodes?: readonly Readonly<{ nodeId: string; architecture: DddNodeArchitecture | null }>[];
  edges?: readonly Readonly<{ edgeId: string; architecture: DddEdgeArchitecture | null }>[];
  /** Complete replacement of the DDD compatibility catalogue, as in resolveDddRelationship. */
  relationships?: ZlozDddRelationshipOptions;
}>;
export type ZlozEventStormingDddNodePreview = Readonly<{
  nodeId: string;
  sourceArchitecture: EventStormingNodeArchitecture;
  reason: string;
}> &
  (
    | Readonly<{
        type: 'proposed';
        architecture: DddNodeArchitecture;
        origin: 'convention' | 'explicit';
      }>
    | Readonly<{ type: 'ambiguous'; candidates: readonly DddNodeArchitecture[] }>
    | Readonly<{ type: 'unmapped' | 'retained' }>
  );
export type ZlozEventStormingDddEdgePreview = Readonly<{
  edgeId: string;
  sourceArchitecture: ZlozEdgeArchitecture | null;
  reason: string;
}> &
  (
    | Readonly<{
        type: 'proposed';
        architecture: DddEdgeArchitecture;
        origin: 'convention' | 'explicit';
      }>
    | Readonly<{
        type: 'blocked';
        code: Extract<ZlozDddRelationshipDecision, { type: 'blocked' }>['code'];
      }>
    | Readonly<{ type: 'unmapped' | 'retained' }>
  );
/** Prospective loss of reserved workshop meaning only. Nothing has been converted or removed. */
export type ZlozEventStormingDddDisclosure = Readonly<{
  kind: 'node' | 'edge';
  id: string;
  code: 'workshop-meaning-replaced';
  reason: string;
}>;
export type ZlozEventStormingDddPreview = Readonly<{
  nodes: readonly ZlozEventStormingDddNodePreview[];
  edges: readonly ZlozEventStormingDddEdgePreview[];
  disclosures: readonly ZlozEventStormingDddDisclosure[];
}>;

function invalid(reason: string): never {
  throw new ZlozError('invalid-edit', reason);
}
function described<T extends DddNodeArchitecture | DddEdgeArchitecture>(
  source: { readonly description?: string } | undefined,
  target: T,
): T {
  if (source?.description !== undefined && target.description === undefined)
    return { ...target, description: source.description };
  return { ...target };
}

/**
 * Pure advisory preview in source graph order. No graph, events, inferred boundaries or apply token
 * are returned. Recompute after source/choices/conventions change. Future conversion must recheck
 * source identity, freshness, policies, lifecycle and atomic Undo independently.
 */
function previewDdd(
  graph: ZlozGraph,
  options: ZlozEventStormingDddMappingOptions,
  mode: ZlozConnectionMode,
  native?: ZlozGroupDocumentV3,
): ZlozEventStormingDddPreview {
  if (native) captureGroupDocumentV3(native);
  else validateGraphForConnectionMode(graph, mode);
  checkedDddRelationshipRules(options.relationships ?? {});
  const notes = graph.nodes.filter((node) => node.architecture?.family === 'event-storming');
  const noteIds = new Set(notes.map((node) => node.id));
  const incident = graph.edges.filter(
    (edge) => noteIds.has(edge.source.node) || noteIds.has(edge.target.node),
  );
  const edgeIds = new Set(incident.map((edge) => edge.id));
  const nodeChoices = new Map<string, DddNodeArchitecture | null>();
  for (const choice of options.nodes ?? []) {
    if (!noteIds.has(choice.nodeId) || nodeChoices.has(choice.nodeId))
      invalid('Node choices require unique existing EventStorming note IDs.');
    const source = notes.find((node) => node.id === choice.nodeId);
    const candidate = source ? { ...source, architecture: choice.architecture } : null;
    if (
      choice.architecture !== null &&
      (!isNodeArchitecture(choice.architecture) ||
        choice.architecture.family !== 'ddd' ||
        !candidate ||
        !validNodeArchitectureFields(candidate))
    )
      invalid(
        'Node choices require a valid DDD descriptor compatible with the existing node kind.',
      );
    nodeChoices.set(choice.nodeId, choice.architecture);
  }
  const edgeChoices = new Map<string, DddEdgeArchitecture | null>();
  for (const choice of options.edges ?? []) {
    if (!edgeIds.has(choice.edgeId) || edgeChoices.has(choice.edgeId))
      invalid('Edge choices require unique existing edges incident to EventStorming notes.');
    if (incident.find((edge) => edge.id === choice.edgeId)?.architecture?.family === 'ddd')
      invalid('Existing DDD relationships are inspected, not remapped by workshop choices.');
    if (choice.architecture !== null && !isDddEdgeArchitecture(choice.architecture))
      invalid('Edge choices require a valid DDD relationship descriptor.');
    edgeChoices.set(choice.edgeId, choice.architecture);
  }
  const nodes: ZlozEventStormingDddNodePreview[] = notes.map((node) => {
    const source = node.architecture;
    if (source?.family !== 'event-storming') invalid('Expected an EventStorming note.');
    const base = { nodeId: node.id, sourceArchitecture: { ...source } };
    const chosen = nodeChoices.get(node.id);
    if (chosen === null)
      return { ...base, type: 'retained', reason: 'Explicitly retain workshop meaning.' };
    if (chosen)
      return {
        ...base,
        type: 'proposed',
        origin: 'explicit',
        architecture: described(source, chosen),
        reason: 'Explicit modelling choice; review before conversion.',
      };
    switch (source.role) {
      case 'domain-event':
        return {
          ...base,
          type: 'proposed',
          origin: 'convention',
          architecture: described(source, { family: 'ddd', role: 'domain-event' }),
          reason:
            'The workshop note is already an explicitly named domain event; review its DDD interpretation.',
        };
      case 'command':
        return {
          ...base,
          type: 'ambiguous',
          candidates: [
            described(source, { family: 'ddd', role: 'aggregate-root' }),
            described(source, { family: 'ddd', role: 'domain-service' }),
          ],
          reason:
            'A command is intent, not its handler. Choose a DDD interpretation explicitly or retain the note; candidates are non-exhaustive.',
        };
      case 'policy':
        return {
          ...base,
          type: 'ambiguous',
          candidates: [described(source, { family: 'ddd', role: 'domain-service' })],
          reason:
            'A workshop policy does not establish a domain service. Even this single candidate requires an explicit choice or retention.',
        };
      case 'external-system':
        return {
          ...base,
          type: 'unmapped',
          reason:
            'An external system is a workshop participant, not an inferred DDD entity, service or bounded context. Retain it or choose an interpretation explicitly.',
        };
      case 'hotspot':
        return {
          ...base,
          type: 'unmapped',
          reason:
            'A hotspot is a discussion annotation with authored resolution status, not a DDD element. Retain it or choose an interpretation explicitly with loss consent.',
        };
      case 'lane':
        return {
          ...base,
          type: 'unmapped',
          reason:
            'A lane is an organizational frame, not an inferred DDD aggregate or bounded context. Retain it or choose a kind-compatible interpretation explicitly.',
        };
      case 'actor':
        return {
          ...base,
          type: 'unmapped',
          reason:
            'An actor has no direct DDD node counterpart. Retain it or author an explicit mapping; do not infer an entity or bounded context.',
        };
    }
  });
  // Private compatibility projection only: retained/ambiguous notes never become inferred DDD endpoints.
  const proposals = new Map(
    nodes.filter((n) => n.type === 'proposed').map((n) => [n.nodeId, n.architecture]),
  );
  const projected: ZlozGraph = {
    ...graph,
    nodes: graph.nodes.map((node) =>
      proposals.has(node.id) ? { ...node, architecture: proposals.get(node.id) } : node,
    ),
  };
  const edges: ZlozEventStormingDddEdgePreview[] = incident.map((edge) => {
    const source = edge.architecture;
    const base = {
      edgeId: edge.id,
      sourceArchitecture: source ? copyEdgeArchitecture(source) : null,
    };
    const chosen = edgeChoices.get(edge.id);
    if (chosen === null)
      return {
        ...base,
        type: 'retained',
        reason: 'Explicitly retain this relationship; no DDD compatibility is claimed.',
      };
    const existing = chosen === undefined && source?.family === 'ddd';
    const candidate = chosen
      ? described(source, chosen)
      : existing
        ? source
        : source?.family === 'event-storming' && source.role === 'emits'
          ? described(source, {
              family: 'ddd',
              scope: 'tactical',
              role: 'emits',
            })
          : null;
    if (!candidate)
      return {
        ...base,
        type: 'unmapped',
        reason: source
          ? 'This causal relationship has no default DDD mapping. Retain it or choose a relationship explicitly; no strategic meaning is inferred.'
          : 'Untyped relationships are not inferred from labels, proximity or compatible endpoints.',
      };
    const architecture = copyEdgeArchitecture(candidate);
    if (architecture.family !== 'ddd') invalid('Expected a DDD relationship.');
    const decision = resolveDddRelationship(
      projected,
      {
        sourceNodeId: edge.source.node,
        targetNodeId: edge.target.node,
        architecture,
      },
      options.relationships,
    );
    if (decision.type === 'blocked')
      return { ...base, type: 'blocked', code: decision.code, reason: decision.reason };
    if (existing)
      return {
        ...base,
        type: 'retained',
        reason: 'Authored DDD meaning remains compatible with the proposed endpoints.',
      };
    return {
      ...base,
      type: 'proposed',
      architecture,
      origin: chosen ? 'explicit' : 'convention',
      reason: chosen
        ? 'Explicit relationship choice is compatible with the proposed endpoints.'
        : 'Authored causal emits matches DDD emits under the current endpoint convention; review before conversion.',
    };
  });
  const disclosures: ZlozEventStormingDddDisclosure[] = [
    ...nodes
      .filter((n) => n.type === 'proposed')
      .map((n) => ({
        kind: 'node' as const,
        id: n.nodeId,
        code: 'workshop-meaning-replaced' as const,
        reason:
          n.sourceArchitecture.role === 'hotspot'
            ? `Conversion would replace the hotspot annotation and its ${n.sourceArchitecture.status} status. Source meaning is retained in provenance; this is not semantic equivalence.`
            : 'Conversion would replace the reserved EventStorming node descriptor. Source meaning is recorded in the preview; preserve provenance separately.',
      })),
    ...edges
      .filter((e) => e.type === 'proposed' && e.sourceArchitecture?.family === 'event-storming')
      .map((e) => ({
        kind: 'edge' as const,
        id: e.edgeId,
        code: 'workshop-meaning-replaced' as const,
        reason:
          'Conversion would replace the reserved causal descriptor with DDD meaning; this is not a lossless semantic equivalence.',
      })),
  ];
  return { nodes, edges, disclosures };
}

export function previewEventStormingDddMapping(
  graph: ZlozGraph,
  options: ZlozEventStormingDddMappingOptions = {},
): ZlozEventStormingDddPreview {
  return previewDdd(graph, options, 'strict');
}
export function previewEventStormingDddMappingV2(
  document: ZlozConnectionDocument,
  options: ZlozEventStormingDddMappingOptions = {},
): ZlozEventStormingDddPreview {
  const checked = parseConnectionDocument(serializeConnectionDocument(document));
  return previewDdd(checked.graph, options, checked.connectionMode);
}

export function previewEventStormingDddMappingV3(
  document: ZlozGroupDocumentV3,
  options: ZlozEventStormingDddMappingOptions = {},
): ZlozEventStormingDddPreview {
  const source = captureGroupDocumentV3(document);
  return previewDdd(source.graph, options, source.connectionMode, source);
}
