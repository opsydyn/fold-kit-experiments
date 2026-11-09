import { createArchitectureNode } from './architecture-node';
import { connectionReason } from './connection-validation';
import { commitGraph } from './editor';
import { copyGraph, validateGraph, ZlozError } from './graph';
import type { EditorPolicy, EditorState, Point, ZlozGraph } from './types';

/** Built-in starter diagrams. These describe notation, not enforced business invariants. */
export type ArchitecturePattern = 'c4-context' | 'ddd-aggregate' | 'event-storming';
export type ZlozPatternInsertionPolicy = EditorPolicy &
  Readonly<{
    /** Complete remapped fragment and current graph, before any publication. */
    canInsertPattern?: (fragment: ZlozGraph, current: ZlozGraph) => string | null;
  }>;
export type ZlozPatternInsertionOptions = Readonly<{
  /** Translation in world units, applied equally to groups and their descendants. */
  offset?: Point;
  policy?: ZlozPatternInsertionPolicy;
}>;
export type ZlozPatternInsertionResult =
  | Readonly<{
      type: 'inserted';
      editor: EditorState;
      nodeIds: ReadonlyMap<string, string>;
      edgeIds: ReadonlyMap<string, string>;
    }>
  | Readonly<{ type: 'unchanged'; editor: EditorState }>
  | Readonly<{ type: 'blocked'; editor: EditorState; reason: string }>;

/** Fresh, detached graph; customize it or pass any self-contained graph to insertPattern. */
export function createArchitecturePattern(pattern: ArchitecturePattern): ZlozGraph {
  if (pattern === 'event-storming') return createEventStormingPattern();
  const ddd = pattern === 'ddd-aggregate';
  if (pattern !== 'ddd-aggregate' && pattern !== 'c4-context')
    throw new ZlozError('invalid-edit', 'Unknown architecture pattern.');
  const source = createArchitectureNode({
    id: 'source',
    label: ddd ? 'Aggregate root' : 'Person',
    position: { x: 30, y: 65 },
    size: { width: 240, height: 140 },
    ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    architecture: ddd
      ? { family: 'ddd', role: 'aggregate-root' }
      : { family: 'c4', role: 'person' },
  });
  const target = createArchitectureNode({
    id: 'target',
    label: ddd ? 'Entity' : 'Software system',
    position: { x: 360, y: 65 },
    size: { width: 240, height: 140 },
    ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    architecture: ddd
      ? { family: 'ddd', role: 'entity' }
      : { family: 'c4', role: 'software-system' },
  });
  const nodes = ddd
    ? [
        createArchitectureNode({
          id: 'boundary',
          label: 'Aggregate',
          kind: 'group',
          position: { x: 0, y: 0 },
          size: { width: 660, height: 260 },
          ports: [],
          architecture: { family: 'ddd', role: 'aggregate' },
        }),
        { ...source, parentId: 'boundary', extent: 'parent' as const },
        { ...target, parentId: 'boundary', extent: 'parent' as const },
      ]
    : [source, target];
  const graph = {
    nodes,
    edges: [
      {
        id: 'relationship',
        source: { node: 'source', port: 'out' },
        target: { node: 'target', port: 'in' },
        label: ddd ? 'Contains' : 'Uses',
      },
    ],
  };
  validateGraph(graph);
  return graph;
}

/** Synchronous, policy-aware transaction. Invalid input throws; expected vetoes preserve editor identity. */
export function insertPattern(
  state: EditorState,
  fragment: ZlozGraph,
  options: ZlozPatternInsertionOptions = {},
): ZlozPatternInsertionResult {
  validateGraph(fragment);
  const offset = options.offset ?? { x: 0, y: 0 };
  if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y))
    throw new ZlozError('invalid-edit', 'Pattern offset must be finite.');
  const blocked = (reason: string): ZlozPatternInsertionResult => ({
    type: 'blocked',
    editor: state,
    reason: reason.trim() || 'Pattern insertion is protected.',
  });
  if (state.readOnly) return blocked('The working model is read-only.');
  if (state.gesture.type !== 'idle' || state.connection !== null || state.edgeLabelDraft !== null)
    return blocked('Finish active edits before inserting a pattern.');
  if (fragment.nodes.length === 0) return { type: 'unchanged', editor: state };
  if (state.historyLimit === 0) return blocked('Enable graph Undo before inserting a pattern.');
  const occupied = new Set(
    [...state.graph.nodes, ...state.graph.edges, ...fragment.nodes, ...fragment.edges].map(
      (item) => item.id,
    ),
  );
  let sequence = 0;
  const allocate = () => {
    let id: string;
    do {
      id = `pattern:${++sequence}`;
    } while (occupied.has(id));
    occupied.add(id);
    return id;
  };
  const nodeIds = new Map(fragment.nodes.map((node) => [node.id, allocate()]));
  const edgeIds = new Map(fragment.edges.map((edge) => [edge.id, allocate()]));
  const detached = copyGraph(fragment);
  const inserted: ZlozGraph = {
    nodes: detached.nodes.map((node) => {
      const copy = {
        ...node,
        id: nodeIds.get(node.id)!,
        position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
      };
      return node.parentId === undefined
        ? copy
        : { ...copy, parentId: nodeIds.get(node.parentId)! };
    }),
    edges: detached.edges.map((edge) => ({
      ...edge,
      id: edgeIds.get(edge.id)!,
      source: { ...edge.source, node: nodeIds.get(edge.source.node)! },
      target: { ...edge.target, node: nodeIds.get(edge.target.node)! },
    })),
  };
  const graph = {
    nodes: [...state.graph.nodes, ...inserted.nodes],
    edges: [...state.graph.edges, ...inserted.edges],
  };
  validateGraph(graph);
  const policy = options.policy ?? {};
  const bulk = policy.canInsertPattern?.(inserted, state.graph) ?? null;
  if (bulk !== null) return blocked(bulk);
  for (const edge of inserted.edges) {
    // Every callback sees the complete proposed graph, excluding only this candidate connection.
    const reason = connectionReason(
      { ...graph, edges: graph.edges.filter((item) => item.id !== edge.id) },
      edge,
      policy,
    );
    if (reason !== null) return blocked(reason);
  }
  const selectedNodes = inserted.nodes
    .filter(
      (node) =>
        node.parentId === undefined && (policy.canSelectNode?.(node, graph) ?? null) === null,
    )
    .map((node) => node.id);
  return {
    type: 'inserted',
    editor: {
      ...commitGraph(state, graph),
      selectedNodes,
      selectedEdges: [],
      notice: `${inserted.nodes.length} pattern nodes inserted`,
    },
    nodeIds,
    edgeIds,
  };
}

function createEventStormingPattern(): ZlozGraph {
  const notes = [
    { role: 'actor', label: 'Customer' },
    { role: 'command', label: 'Place order' },
    { role: 'domain-event', label: 'Order placed' },
    { role: 'policy', label: 'When order placed, request payment' },
    { role: 'command', label: 'Request payment' },
  ] as const;
  const nodes = notes.map(({ role, label }, index) =>
    createArchitectureNode({
      id: `note:${index}`,
      label,
      architecture: { family: 'event-storming', role },
      position: { x: index * 340, y: 40 },
      size: { width: 220, height: 160 },
      ports: [
        ...(index > 0
          ? [{ id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 }]
          : []),
        ...(index < notes.length - 1
          ? [{ id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 }]
          : []),
      ],
    }),
  );
  const graph = {
    nodes,
    edges: ['Decides', 'Produces', 'Whenever', 'Then'].map((label, index) => ({
      id: `step:${index}`,
      label,
      source: { node: nodes[index]!.id, port: 'out' },
      target: { node: nodes[index + 1]!.id, port: 'in' },
    })),
  };
  validateGraph(graph);
  return graph;
}
