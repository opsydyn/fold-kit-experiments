import { translateEdgeWaypoints } from './edge-waypoints';
import { editFields, editIdentifier, editPoint, editRecord, ownEditorEdit } from './edit-data';
import { ZlozError } from './graph';
import { captureGroupDocumentV3, type ZlozGroupDocumentV3 } from './group-document-v3';
import {
  applyGroupEditorTransactionV3,
  captureGroupEditorSourceV3,
  reviewGroupEditorTransactionV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorPolicyV3,
  type ZlozGroupEditorSourceV3,
  type ZlozGroupEditorResultV3,
  type ZlozGroupEditorTransactionV3,
} from './group-editor-v3';
import { assertGroupGeometryConstraintsV3 } from './group-operations-v3';
import { withDescendants } from './group-presentation';
import { ownPortableData } from './portable-data';
import type { JsonValue, Point, ZlozNode } from './types';

/** Model-owned data, never a runtime session or authority to paste. No OS clipboard IO is implied. */
export type ZlozGroupClipboardV3 = Readonly<{
  format: 'foldkit-zloz-clipboard';
  version: 3;
  /** Rooted world-space fragment. Mode/capability stay explicit; camera is not copied. */
  document: ZlozGroupDocumentV3;
}>;
export type ZlozGroupClipboardFindingV3 = Readonly<{
  code: 'parent-detached' | 'boundary-edge-omitted';
  id: string;
  reason: string;
}>;
export type ZlozGroupClipboardPolicyV3 = ZlozGroupEditorPolicyV3 &
  Readonly<{
    /** Pure live veto for the entire descendant-inclusive copy, including detached/omitted findings. */
    canCopyGroupFragmentV3?: (
      clipboard: ZlozGroupClipboardV3,
      source: ZlozGroupDocumentV3,
    ) => string | null;
  }>;
export type ZlozGroupPasteIdentitiesV3 = Readonly<{
  nodes: readonly Readonly<{ from: string; to: string }>[];
  edges: readonly Readonly<{ from: string; to: string }>[];
  /** Port identities are scoped to their original owner; endpoints follow both mappings. */
  ports: readonly Readonly<{ nodeId: string; from: string; to: string }>[];
}>;
export type ZlozGroupPasteRequestV3 = Readonly<{
  source: ZlozGroupEditorSourceV3;
  clipboard: ZlozGroupClipboardV3;
  identities: ZlozGroupPasteIdentitiesV3;
  /** World-space translation, applied exactly once to every node and authored waypoint. */
  offset: Point;
}>;
type ClipboardBlocked = Readonly<{
  type: 'blocked';
  editor: ZlozGroupEditorStateV3;
  code:
    | 'invalid-edit'
    | 'empty-selection'
    | 'not-found'
    | 'incompatible'
    | 'identity-conflict'
    | 'constraint'
    | 'protected'
    | 'busy';
  reason: string;
}>;
export type ZlozGroupCopyResultV3 =
  | ClipboardBlocked
  | Readonly<{
      type: 'copied';
      editor: ZlozGroupEditorStateV3;
      clipboard: ZlozGroupClipboardV3;
      rootNodeIds: readonly string[];
      findings: readonly ZlozGroupClipboardFindingV3[];
    }>;
export type ZlozGroupPasteResultV3 =
  | ClipboardBlocked
  | Extract<ZlozGroupEditorResultV3, { type: 'blocked' }>
  | Readonly<{ type: 'unchanged'; editor: ZlozGroupEditorStateV3 }>
  | Readonly<{
      type: 'applied';
      editor: ZlozGroupEditorStateV3;
      rootNodeIds: readonly string[];
      identities: ZlozGroupPasteIdentitiesV3;
    }>;
export type ZlozGroupPastePlanV3 =
  | Exclude<ZlozGroupPasteResultV3, { type: 'applied' }>
  | Readonly<{
      type: 'ready';
      editor: ZlozGroupEditorStateV3;
      request: ZlozGroupPasteRequestV3;
      transaction: ZlozGroupEditorTransactionV3;
      rootNodeIds: readonly string[];
    }>;
const blocked = (
  editor: ZlozGroupEditorStateV3,
  code: ClipboardBlocked['code'],
  reason: string,
): ClipboardBlocked => ({ type: 'blocked', editor, code, reason });
const identifiers = (value: JsonValue): value is readonly string[] =>
  Array.isArray(value) && value.every(editIdentifier) && new Set(value).size === value.length;
function captureClipboard(input: ZlozGroupClipboardV3): ZlozGroupClipboardV3 {
  const owned = ownPortableData(input, undefined, 'V3 clipboard');
  if (
    !editRecord(owned) ||
    !editFields(owned, ['format', 'version', 'document']) ||
    owned.format !== 'foldkit-zloz-clipboard' ||
    owned.version !== 3
  )
    throw new ZlozError('invalid-edit', 'Expected an explicit v3 clipboard fragment.');
  const document = captureGroupDocumentV3(owned.document);
  if (document.viewport !== undefined || document.graph.nodes.length === 0)
    throw new ZlozError(
      'invalid-edit',
      'Clipboard fragments need at least one node and cannot own a camera.',
    );
  return Object.freeze({ format: 'foldkit-zloz-clipboard', version: 3, document });
}
/** Copy a current selection plus descendants; sever only external parents and omit crossing edges with findings. Read-only copying is allowed. */
export function copyGroupSelectionV3(
  editor: ZlozGroupEditorStateV3,
  nodeIds: readonly string[],
  policy: ZlozGroupClipboardPolicyV3 = {},
): ZlozGroupCopyResultV3 {
  let copied: Extract<ZlozGroupCopyResultV3, { type: 'copied' }>;
  // oxlint-disable-next-line linteffect/no-try-catch -- Translate only known bounded data/graph failures; host policy exceptions propagate.
  try {
    const source = captureGroupEditorSourceV3(editor),
      ids = ownEditorEdit(nodeIds, identifiers, 'v3 clipboard selection');
    if (editor.activity.type === 'busy') return blocked(editor, 'busy', editor.activity.reason);
    if (ids.length === 0)
      return blocked(editor, 'empty-selection', 'Select at least one node or group to copy.');
    const graph = source.document.graph;
    if (ids.some((id) => !graph.nodes.some((n) => n.id === id)))
      return blocked(editor, 'not-found', 'A selected node no longer exists.');
    const included = withDescendants(graph, ids),
      findings: ZlozGroupClipboardFindingV3[] = [];
    const nodes = graph.nodes
      .filter((n) => included.has(n.id))
      .map((n): ZlozNode => {
        if (n.parentId === undefined || included.has(n.parentId)) return n;
        findings.push({
          code: 'parent-detached',
          id: n.id,
          reason: `Node ${n.id} is copied as a root; its external parent and parent constraints are not copied.`,
        });
        const { parentId: _parent, extent: _extent, expandParent: _expand, ...root } = n;
        return root;
      });
    const edges = graph.edges.filter((e) => {
      const a = included.has(e.source.node),
        b = included.has(e.target.node);
      if (a !== b)
        findings.push({
          code: 'boundary-edge-omitted',
          id: e.id,
          reason: `Connection ${e.id} crosses the copied selection and is omitted.`,
        });
      return a && b;
    });
    const document = captureGroupDocumentV3({
      version: 3,
      coordinateSpace: 'world',
      connectionMode: source.document.connectionMode,
      capabilities: source.document.capabilities,
      graph: { nodes, edges },
    });
    copied = Object.freeze({
      type: 'copied',
      editor,
      clipboard: Object.freeze({ format: 'foldkit-zloz-clipboard', version: 3, document }),
      rootNodeIds: Object.freeze(nodes.filter((n) => n.parentId === undefined).map((n) => n.id)),
      findings: Object.freeze(findings.map((f) => Object.freeze(f))),
    });
  } catch (error) {
    if (error instanceof ZlozError) return blocked(editor, 'invalid-edit', error.message);
    throw error;
  }
  const reason = policy.canCopyGroupFragmentV3?.(copied.clipboard, editor.document);
  return reason == null
    ? copied
    : blocked(editor, 'protected', reason.trim() || 'Copying this fragment is protected.');
}
function validMappings(
  value: JsonValue,
): value is JsonValue & Readonly<{ identities: ZlozGroupPasteIdentitiesV3; offset: Point }> {
  if (
    !editRecord(value) ||
    !editFields(value, ['identities', 'offset']) ||
    !editPoint(value.offset) ||
    !editRecord(value.identities) ||
    !editFields(value.identities, ['nodes', 'edges', 'ports'])
  )
    return false;
  const identities = value.identities;
  return (['nodes', 'edges', 'ports'] as const).every((kind) => {
    const entries = identities[kind];
    return (
      Array.isArray(entries) &&
      entries.every(
        (entry) =>
          editRecord(entry) &&
          editFields(entry, kind === 'ports' ? ['nodeId', 'from', 'to'] : ['from', 'to']) &&
          editIdentifier(entry.from) &&
          editIdentifier(entry.to) &&
          (kind !== 'ports' || editIdentifier(entry.nodeId)),
      )
    );
  });
}
/** Allocate collision-free default IDs, or preserve a designer/host's complete explicit maps. No document mutation or cached permission. */
export function groupPasteRequestV3(
  editor: ZlozGroupEditorStateV3,
  input: ZlozGroupClipboardV3,
  options: Readonly<{ offset: Point; identities?: ZlozGroupPasteIdentitiesV3 }>,
): ZlozGroupPasteRequestV3 {
  const source = captureGroupEditorSourceV3(editor),
    clipboard = captureClipboard(input),
    graph = clipboard.document.graph;
  const ownedOptions = ownPortableData(options, undefined, 'V3 paste options');
  if (
    !editRecord(ownedOptions) ||
    !editFields(ownedOptions, ['offset'], ['identities']) ||
    !editPoint(ownedOptions.offset)
  )
    throw new ZlozError('invalid-edit', 'Provide a finite world-space paste offset.');
  const taken = new Set(
    [
      ...source.document.graph.nodes,
      ...source.document.graph.edges,
      ...graph.nodes,
      ...graph.edges,
    ].map((item) => item.id),
  );
  let sequence = 0;
  const next = () => {
    let id: string;
    do {
      id = `paste:${editor.revision + 1}:${sequence++}`;
    } while (taken.has(id));
    taken.add(id);
    return id;
  };
  const identities = Object.hasOwn(ownedOptions, 'identities')
    ? ownedOptions.identities
    : {
        nodes: graph.nodes.map((n) => ({ from: n.id, to: next() })),
        edges: graph.edges.map((e) => ({ from: e.id, to: next() })),
        ports: graph.nodes.flatMap((n) =>
          n.ports.map((p) => ({ nodeId: n.id, from: p.id, to: next() })),
        ),
      };
  const edit = ownPortableData(
    { identities, offset: ownedOptions.offset },
    undefined,
    'V3 paste mappings',
  );
  if (!validMappings(edit)) throw new ZlozError('invalid-edit', 'Invalid v3 paste mappings.');
  return Object.freeze({ source, clipboard, identities: edit.identities, offset: edit.offset });
}
function build(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupPasteRequestV3,
): Exclude<ZlozGroupPastePlanV3, { type: 'unchanged' }> {
  const fresh = reviewGroupEditorTransactionV3(editor, {
    source: request.source,
    document: editor.document,
  });
  if (fresh.type === 'blocked') return fresh;
  // oxlint-disable-next-line linteffect/no-try-catch -- Known data/geometry failures become blocked plans; live policy checks remain outside.
  try {
    const clipboard = captureClipboard(request.clipboard),
      edit = ownEditorEdit(
        { identities: request.identities, offset: request.offset },
        validMappings,
        'v3 paste mappings',
      ),
      source = captureGroupEditorSourceV3(editor),
      graph = clipboard.document.graph;
    if (
      clipboard.document.connectionMode !== source.document.connectionMode ||
      clipboard.document.capabilities.groupPorts !== source.document.capabilities.groupPorts
    )
      return blocked(
        editor,
        'incompatible',
        'Clipboard and target must have the same connection mode and group-port capability. No implicit conversion is performed.',
      );
    const taken = new Set(
      [
        ...source.document.graph.nodes,
        ...source.document.graph.edges,
        ...graph.nodes,
        ...graph.edges,
      ].map((item) => item.id),
    );
    const mapIds = (kind: 'nodes' | 'edges') => {
      const expected = new Set(graph[kind].map((item) => item.id)),
        mapping = new Map<string, string>();
      for (const pair of edit.identities[kind]) {
        if (!expected.has(pair.from) || mapping.has(pair.from) || taken.has(pair.to))
          throw new ZlozError(
            'invalid-edit',
            'Node and edge identity maps must be complete, exact and fresh across both namespaces.',
          );
        mapping.set(pair.from, pair.to);
        taken.add(pair.to);
      }
      if (mapping.size !== expected.size)
        throw new ZlozError('invalid-edit', 'Missing node or edge identity mappings.');
      return mapping;
    };
    const nodeIds = mapIds('nodes'),
      edgeIds = mapIds('edges'),
      portIds = new Map<string, Map<string, string>>();
    for (const node of graph.nodes) portIds.set(node.id, new Map());
    for (const pair of edit.identities.ports) {
      const node = graph.nodes.find((n) => n.id === pair.nodeId),
        mapping = portIds.get(pair.nodeId);
      if (
        !node?.ports.some((p) => p.id === pair.from) ||
        !mapping ||
        mapping.has(pair.from) ||
        [...mapping.values()].includes(pair.to)
      )
        return blocked(
          editor,
          'identity-conflict',
          'Port mappings must exactly cover each scoped port with distinct output IDs per owner.',
        );
      mapping.set(pair.from, pair.to);
    }
    if (graph.nodes.some((n) => portIds.get(n.id)?.size !== n.ports.length))
      return blocked(editor, 'identity-conflict', 'Missing scoped port identity mappings.');
    const mapped = (mapping: ReadonlyMap<string, string>, id: string) => {
      const value = mapping.get(id);
      if (value === undefined)
        throw new ZlozError('invalid-edit', 'Missing clipboard identity mapping.');
      return value;
    };
    const nodes = graph.nodes.map((node): ZlozNode => {
      const copy = {
        ...node,
        id: mapped(nodeIds, node.id),
        position: { x: node.position.x + edit.offset.x, y: node.position.y + edit.offset.y },
        ports: node.ports.map((port) => ({ ...port, id: mapped(portIds.get(node.id)!, port.id) })),
      };
      return node.parentId === undefined
        ? copy
        : { ...copy, parentId: mapped(nodeIds, node.parentId) };
    });
    const edges = graph.edges.map((edge) => ({
      ...translateEdgeWaypoints(edge, edit.offset),
      id: mapped(edgeIds, edge.id),
      source: {
        node: mapped(nodeIds, edge.source.node),
        port: mapped(portIds.get(edge.source.node)!, edge.source.port),
      },
      target: {
        node: mapped(nodeIds, edge.target.node),
        port: mapped(portIds.get(edge.target.node)!, edge.target.port),
      },
    }));
    const document = captureGroupDocumentV3({
      ...source.document,
      graph: {
        nodes: [...source.document.graph.nodes, ...nodes],
        edges: [...source.document.graph.edges, ...edges],
      },
    });
    assertGroupGeometryConstraintsV3(source.document.graph, document.graph);
    return Object.freeze({
      type: 'ready',
      editor,
      request: Object.freeze({ source, clipboard, ...edit }),
      transaction: Object.freeze({ source, document }),
      rootNodeIds: Object.freeze(nodes.filter((n) => n.parentId === undefined).map((n) => n.id)),
    });
  } catch (error) {
    if (error instanceof ZlozError) return blocked(editor, 'invalid-edit', error.message);
    throw error;
  }
}
/** Review full target and current port, connection and complete-transaction policies without publication. */
export function planGroupPasteV3(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupPasteRequestV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupPastePlanV3 {
  const plan = build(editor, request);
  if (plan.type !== 'ready') return plan;
  const review = reviewGroupEditorTransactionV3(editor, plan.transaction, policy);
  return review.type === 'ready' ? plan : review;
}
/** Rebuild from intent and current source; no partial nodes/ports/edges or separate Undo frames. */
export function applyGroupPasteV3(
  editor: ZlozGroupEditorStateV3,
  request: ZlozGroupPasteRequestV3,
  policy: ZlozGroupEditorPolicyV3 = {},
): ZlozGroupPasteResultV3 {
  const plan = build(editor, request);
  if (plan.type !== 'ready') return plan;
  const result = applyGroupEditorTransactionV3(editor, plan.transaction, policy);
  if (result.type === 'blocked') return result;
  if (result.type === 'unchanged') return { type: 'unchanged', editor: result.editor };
  return {
    type: 'applied',
    editor: result.editor,
    rootNodeIds: plan.rootNodeIds,
    identities: plan.request.identities,
  };
}
