import {
  copyEdgeArchitecture,
  isNodeArchitecture,
  validNodeArchitectureFields,
  type C4NodeArchitecture,
  type EventStormingNodeArchitecture,
  type ZlozEdgeArchitecture,
} from './architecture';
import { ZlozError } from './graph';
import { captureModelDocument, type ZlozModelDocument } from './model-document';
import { captureModelDocumentV2, type ZlozModelDocumentV2 } from './model-document-v2';
import { captureModelDocumentV3, type ZlozModelDocumentV3 } from './model-document-v3';

/** Host-owned live scope, captured for review; neither identity nor revision grants edit authority. */
export type ZlozEventStormingC4Source<D extends ZlozModelDocument = ZlozModelDocument> = Readonly<{
  document: D;
  sessionId: string;
  revision: number;
}>;
/** Null explicitly retains workshop meaning. A mapping may explicitly rename intent as structure. */
export type ZlozEventStormingC4NodeChoice = Readonly<{ nodeId: string }> &
  (
    | Readonly<{ architecture: null }>
    | Readonly<{ architecture: C4NodeArchitecture; label?: string }>
  );
/** An explicitly named communication, not a new reserved C4 edge descriptor or inferred causal link. */
export type ZlozEventStormingC4Relationship = Readonly<{ label: string }>;
export type ZlozEventStormingC4EdgeChoice = Readonly<{
  edgeId: string;
  relationship: ZlozEventStormingC4Relationship | null;
}>;
export type ZlozEventStormingC4MappingOptions = Readonly<{
  nodes?: readonly ZlozEventStormingC4NodeChoice[];
  edges?: readonly ZlozEventStormingC4EdgeChoice[];
}>;
export type ZlozEventStormingC4NodePreview = Readonly<{
  nodeId: string;
  sourceArchitecture: EventStormingNodeArchitecture;
  reason: string;
}> &
  (
    | Readonly<{
        type: 'proposed';
        origin: 'explicit';
        architecture: C4NodeArchitecture;
        label: string;
      }>
    | Readonly<{ type: 'ambiguous'; candidates: readonly C4NodeArchitecture[] }>
    | Readonly<{ type: 'retained' | 'unmapped' }>
  );
export type ZlozEventStormingC4EdgePreview = Readonly<{
  edgeId: string;
  sourceArchitecture: ZlozEdgeArchitecture | null;
  reason: string;
}> &
  (
    | Readonly<{
        type: 'proposed';
        origin: 'explicit';
        relationship: ZlozEventStormingC4Relationship;
      }>
    | Readonly<{ type: 'blocked'; code: 'endpoint-not-c4' }>
    | Readonly<{ type: 'retained' | 'unmapped' }>
  );
/** Prospective losses of meaning or authorship, not evidence of semantic equivalence or consent. */
export type ZlozEventStormingC4Disclosure = Readonly<{
  kind: 'node' | 'edge';
  id: string;
  code:
    | 'workshop-meaning-replaced'
    | 'hotspot-status-replaced'
    | 'organizational-frame-reinterpreted'
    | 'membership-not-c4-containment'
    | 'relationship-meaning-replaced'
    | 'label-replaced'
    | 'description-replaced';
  reason: string;
}>;
export type ZlozEventStormingC4Preview<D extends ZlozModelDocument = ZlozModelDocument> = Readonly<{
  /** Detached complete document, camera, editions and fork ancestry, plus live host scope. */
  provenance: ZlozEventStormingC4Source<D>;
  /** Detached explicit inputs, including retention choices; no conventions are silently applied. */
  choices: Readonly<{
    nodes: readonly ZlozEventStormingC4NodeChoice[];
    edges: readonly ZlozEventStormingC4EdgeChoice[];
  }>;
  nodes: readonly ZlozEventStormingC4NodePreview[];
  edges: readonly ZlozEventStormingC4EdgePreview[];
  disclosures: readonly ZlozEventStormingC4Disclosure[];
}>;
function invalid(reason: string): never {
  throw new ZlozError('invalid-edit', reason);
}
/** Only the record envelope is established here; each reserved field is checked separately. */
type MappingFields = Readonly<{
  sessionId?: unknown;
  revision?: unknown;
  nodes?: unknown;
  edges?: unknown;
  nodeId?: unknown;
  edgeId?: unknown;
  architecture?: unknown;
  relationship?: unknown;
  label?: unknown;
}>;
function record(value: unknown): value is MappingFields {
  return (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function fields(value: MappingFields, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function freeze<T>(value: T): T {
  if ((Array.isArray(value) || record(value)) && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function described(
  source: EventStormingNodeArchitecture,
  target: C4NodeArchitecture,
): C4NodeArchitecture {
  return source.description !== undefined && target.description === undefined
    ? { ...target, description: source.description }
    : { ...target };
}
/**
 * Pure advisory, source-ordered preview. No graph, editor event, conversion, consent token or Apply
 * authority is returned. Recompute after source/session/revision/choices change. Geometry, ports,
 * membership and direction are not changed; workshop lanes never infer runtime ownership. A future
 * conversion plan must separately validate containment, exact losses, live policies and atomic Undo.
 */
function previewC4<D extends ZlozModelDocument>(
  source: ZlozEventStormingC4Source<D>,
  options: ZlozEventStormingC4MappingOptions,
  capture: (document: D) => D,
): ZlozEventStormingC4Preview<D> {
  if (
    !record(source) ||
    !text(source.sessionId) ||
    !Number.isSafeInteger(source.revision) ||
    source.revision < 0
  )
    invalid(
      'C4 previews require a nonempty source session ID and nonnegative safe integer revision.',
    );
  const provenance = {
    document: capture(source.document),
    sessionId: source.sessionId,
    revision: source.revision,
  };
  if (
    !record(options) ||
    !fields(options, ['nodes', 'edges']) ||
    (options.nodes !== undefined && !Array.isArray(options.nodes)) ||
    (options.edges !== undefined && !Array.isArray(options.edges))
  )
    invalid('C4 mapping options require node and edge choice arrays.');
  const graph = provenance.document.snapshot.graph;
  const notes = graph.nodes.filter((node) => node.architecture?.family === 'event-storming');
  const noteIds = new Set(notes.map((node) => node.id));
  const incident = graph.edges.filter(
    (edge) => noteIds.has(edge.source.node) || noteIds.has(edge.target.node),
  );
  const edgeIds = new Set(incident.map((edge) => edge.id));
  const nodeChoices = new Map<string, ZlozEventStormingC4NodeChoice>();
  const authoredNodes: readonly ZlozEventStormingC4NodeChoice[] = options.nodes ?? [];
  for (const choice of authoredNodes) {
    if (
      !record(choice) ||
      !fields(choice, ['nodeId', 'architecture', 'label']) ||
      !noteIds.has(choice.nodeId) ||
      nodeChoices.has(choice.nodeId)
    )
      invalid('Node choices require unique existing EventStorming node IDs and declared fields.');
    const node = notes.find((n) => n.id === choice.nodeId);
    if (choice.architecture === null) {
      if ('label' in choice) invalid('Retained workshop nodes cannot be renamed by a C4 choice.');
      nodeChoices.set(choice.nodeId, { nodeId: choice.nodeId, architecture: null });
    } else {
      const candidate = node ? { ...node, architecture: choice.architecture } : null;
      if (
        !isNodeArchitecture(choice.architecture) ||
        choice.architecture.family !== 'c4' ||
        !candidate ||
        !validNodeArchitectureFields(candidate)
      )
        invalid(
          'Node choices require valid C4 descriptors compatible with the existing node kind.',
        );
      if ('label' in choice && !text(choice.label))
        invalid('Explicit C4 node labels must be nonempty text.');
      const picked = { nodeId: choice.nodeId, architecture: { ...choice.architecture } };
      nodeChoices.set(
        choice.nodeId,
        'label' in choice ? { ...picked, label: choice.label } : picked,
      );
    }
  }
  const edgeChoices = new Map<string, ZlozEventStormingC4EdgeChoice>();
  const authoredEdges: readonly ZlozEventStormingC4EdgeChoice[] = options.edges ?? [];
  for (const choice of authoredEdges) {
    if (
      !record(choice) ||
      !fields(choice, ['edgeId', 'relationship']) ||
      !edgeIds.has(choice.edgeId) ||
      edgeChoices.has(choice.edgeId)
    )
      invalid(
        'Edge choices require unique existing edges incident to EventStorming nodes and declared fields.',
      );
    if (
      choice.relationship !== null &&
      (!record(choice.relationship) ||
        !fields(choice.relationship, ['label']) ||
        !text(choice.relationship.label))
    )
      invalid('C4 relationships require an explicit nonempty communication label.');
    edgeChoices.set(choice.edgeId, {
      edgeId: choice.edgeId,
      relationship: choice.relationship === null ? null : { label: choice.relationship.label },
    });
  }
  const nodes: ZlozEventStormingC4NodePreview[] = notes.map((node) => {
    const architecture = node.architecture;
    if (architecture?.family !== 'event-storming') invalid('Expected EventStorming meaning.');
    const base = { nodeId: node.id, sourceArchitecture: architecture };
    const choice = nodeChoices.get(node.id);
    if (choice?.architecture === null)
      return {
        ...base,
        type: 'retained',
        reason: 'Explicitly retain workshop meaning; no C4 interpretation is claimed.',
      };
    if (choice)
      return {
        ...base,
        type: 'proposed',
        origin: 'explicit',
        architecture: described(architecture, choice.architecture),
        label: choice.label ?? node.label,
        reason:
          'Explicit structural interpretation, not semantic equivalence or permission to convert.',
      };
    switch (architecture.role) {
      case 'actor':
        return {
          ...base,
          type: 'ambiguous',
          candidates: [
            { family: 'c4', role: 'person' },
            { family: 'c4', role: 'software-system' },
          ],
          reason:
            'A workshop actor may be human or automated. Choose a C4 interpretation or retain it; candidates are non-exhaustive and do not infer scope.',
        };
      case 'external-system':
        return {
          ...base,
          type: 'ambiguous',
          candidates: [
            { family: 'c4', role: 'software-system' },
            { family: 'c4', role: 'container' },
          ],
          reason:
            'External to a workshop does not establish C4 scope or abstraction level. Choose explicitly or retain; candidates are non-exhaustive.',
        };
      case 'lane':
        return {
          ...base,
          type: 'unmapped',
          reason:
            'Workshop organization is not runtime ownership or a C4 boundary. Retain this frame or explicitly reinterpret it with loss reporting.',
        };
      case 'hotspot':
        return {
          ...base,
          type: 'unmapped',
          reason:
            'A hotspot is an annotation with authored status, not a C4 element. Retain it or explicitly reinterpret it with status loss reporting.',
        };
      case 'command':
        return {
          ...base,
          type: 'unmapped',
          reason:
            'Intent does not identify its handler, software system, container or component. Choose an explicit structural interpretation and name or retain the command.',
        };
      case 'domain-event':
        return {
          ...base,
          type: 'unmapped',
          reason:
            'A fact is not a C4 structure or communication. Retain the event or explicitly name a structural interpretation.',
        };
      case 'policy':
        return {
          ...base,
          type: 'unmapped',
          reason:
            'A workshop policy does not establish a deployable container or component. Retain it or explicitly name its structural interpretation.',
        };
    }
  });
  const proposed = new Set(
    nodes.filter((node) => node.type === 'proposed').map((node) => node.nodeId),
  );
  const c4Endpoint = (id: string) =>
    proposed.has(id) || graph.nodes.find((node) => node.id === id)?.architecture?.family === 'c4';
  const edges: ZlozEventStormingC4EdgePreview[] = incident.map((edge) => {
    const base = {
      edgeId: edge.id,
      sourceArchitecture: edge.architecture ? copyEdgeArchitecture(edge.architecture) : null,
    };
    const choice = edgeChoices.get(edge.id);
    if (choice?.relationship === null)
      return {
        ...base,
        type: 'retained',
        reason:
          'Explicitly retain this relationship; C4 communication compatibility is not claimed.',
      };
    if (!choice)
      return {
        ...base,
        type: 'unmapped',
        reason:
          'Workshop causality, labels and compatible endpoints do not establish C4 communication. Explicitly name a communication or retain the relationship.',
      };
    if (!c4Endpoint(edge.source.node) || !c4Endpoint(edge.target.node))
      return {
        ...base,
        type: 'blocked',
        code: 'endpoint-not-c4',
        reason:
          'Both endpoints must have explicit C4 proposals or existing authored C4 meaning. Retained or unresolved workshop notes are not inferred endpoints.',
      };
    return {
      ...base,
      type: 'proposed',
      origin: 'explicit',
      relationship: { ...choice.relationship },
      reason:
        'Explicit directed communication label; endpoint identity and direction are preserved, not inferred from causal meaning. This is not an architectural correctness check.',
    };
  });
  const disclosures: ZlozEventStormingC4Disclosure[] = [];
  const add = (
    kind: 'node' | 'edge',
    id: string,
    code: ZlozEventStormingC4Disclosure['code'],
    reason: string,
  ) => disclosures.push({ kind, id, code, reason });
  for (const node of nodes) {
    if (node.type !== 'proposed') continue;
    const original = graph.nodes.find((n) => n.id === node.nodeId);
    if (!original) invalid('Missing source node.');
    add(
      'node',
      node.nodeId,
      'workshop-meaning-replaced',
      'C4 interpretation would replace the reserved workshop descriptor, not preserve equivalent meaning. Complete source meaning remains in preview provenance.',
    );
    if (node.sourceArchitecture.role === 'hotspot')
      add(
        'node',
        node.nodeId,
        'hotspot-status-replaced',
        `The hotspot annotation and its authored ${node.sourceArchitecture.status} status would be replaced. Resolved is not architectural validation.`,
      );
    if (node.sourceArchitecture.role === 'lane')
      add(
        'node',
        node.nodeId,
        'organizational-frame-reinterpreted',
        'An organizational lane would be reinterpreted as a runtime boundary; this requires explicit review, not inferred ownership.',
      );
    if (original.parentId || graph.nodes.some((child) => child.parentId === node.nodeId))
      add(
        'node',
        node.nodeId,
        'membership-not-c4-containment',
        'Existing world-coordinate membership is retained as source data, not validated C4 containment. A future conversion must separately resolve boundary ownership.',
      );
    if (node.label !== original.label)
      add(
        'node',
        node.nodeId,
        'label-replaced',
        'The authored workshop label would be replaced by an explicit structural name.',
      );
    if (
      node.sourceArchitecture.description !== undefined &&
      node.architecture.description !== node.sourceArchitecture.description
    )
      add(
        'node',
        node.nodeId,
        'description-replaced',
        'The authored workshop description would be replaced; the original remains in provenance.',
      );
  }
  for (const edge of edges) {
    if (edge.type !== 'proposed') continue;
    if (edge.sourceArchitecture)
      add(
        'edge',
        edge.edgeId,
        'relationship-meaning-replaced',
        'The reserved relationship descriptor would be replaced by a plain, explicitly named C4 communication. Causal order, DDD meaning and runtime communication are not equivalent.',
      );
    const originalLabel = graph.edges.find((original) => original.id === edge.edgeId)?.label;
    if (originalLabel !== undefined && originalLabel !== edge.relationship.label)
      add(
        'edge',
        edge.edgeId,
        'label-replaced',
        'The source edge label would be replaced by an explicit communication label.',
      );
  }
  return freeze({
    provenance,
    choices: { nodes: [...nodeChoices.values()], edges: [...edgeChoices.values()] },
    nodes,
    edges,
    disclosures,
  });
}

export function previewEventStormingC4Mapping(
  source: ZlozEventStormingC4Source,
  options: ZlozEventStormingC4MappingOptions = {},
): ZlozEventStormingC4Preview {
  return previewC4(source, options, captureModelDocument);
}
export type ZlozEventStormingC4SourceV2 = ZlozEventStormingC4Source<ZlozModelDocumentV2>;
export type ZlozEventStormingC4PreviewV2 = ZlozEventStormingC4Preview<ZlozModelDocumentV2>;
export function previewEventStormingC4MappingV2(
  source: ZlozEventStormingC4SourceV2,
  options: ZlozEventStormingC4MappingOptions = {},
): ZlozEventStormingC4PreviewV2 {
  return previewC4(source, options, captureModelDocumentV2);
}

export type ZlozEventStormingC4SourceV3 = ZlozEventStormingC4Source<ZlozModelDocumentV3>;
export type ZlozEventStormingC4PreviewV3 = ZlozEventStormingC4Preview<ZlozModelDocumentV3>;
export function previewEventStormingC4MappingV3(
  source: ZlozEventStormingC4SourceV3,
  options: ZlozEventStormingC4MappingOptions = {},
): ZlozEventStormingC4PreviewV3 {
  return previewC4(source, options, captureModelDocumentV3);
}
