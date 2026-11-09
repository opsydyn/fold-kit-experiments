import { expect, test } from 'bun:test';

import {
  createEditor,
  createArchitecturePattern,
  insertPattern,
  updateEditor,
  validateGraph,
  serializeGraph,
  parseGraph,
} from '../src/index';

test('repeated pattern insertion remaps every reference and commits once without replacing existing data', () => {
  const pattern = createArchitecturePattern('ddd-aggregate');
  const original = serializeGraph(pattern);
  const initial = createEditor(pattern, { viewport: { x: 12, y: 34, zoom: 0.8 } });
  const result = insertPattern(initial, pattern, { offset: { x: 900, y: 30 } });
  expect(result.type).toBe('inserted');
  if (result.type !== 'inserted') throw new Error('Insertion rejected');
  expect(result.editor.graph.nodes).toHaveLength(pattern.nodes.length * 2);
  expect(result.editor.graph.nodes.slice(0, pattern.nodes.length)).toEqual([...pattern.nodes]);
  for (const node of pattern.nodes) {
    const copy = result.editor.graph.nodes.find((item) => item.id === result.nodeIds.get(node.id))!;
    expect(copy.id).not.toBe(node.id);
    expect(copy.position).toEqual({ x: node.position.x + 900, y: node.position.y + 30 });
    expect(copy.ports).toEqual(node.ports);
    expect(copy.architecture).toEqual(node.architecture);
    if (node.parentId) expect(copy.parentId).toBe(result.nodeIds.get(node.parentId));
  }
  for (const edge of pattern.edges) {
    const copy = result.editor.graph.edges.find((item) => item.id === result.edgeIds.get(edge.id))!;
    expect(copy.source).toEqual({
      node: result.nodeIds.get(edge.source.node)!,
      port: edge.source.port,
    });
    expect(copy.target).toEqual({
      node: result.nodeIds.get(edge.target.node)!,
      port: edge.target.port,
    });
  }
  expect(result.editor.viewport).toBe(initial.viewport);
  expect(result.editor.past).toEqual([initial.graph]);
  expect(result.editor.revision).toBe(initial.revision + 1);
  const undone = updateEditor(result.editor, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(result.editor.graph);
  expect(parseGraph(serializeGraph(result.editor.graph))).toEqual(result.editor.graph);
  expect(serializeGraph(pattern)).toBe(original);
  const repeated = insertPattern(result.editor, pattern);
  expect(repeated.type).toBe('inserted');
  validateGraph(repeated.editor.graph);
});

test('whole pattern, endpoint and connection vetoes reject atomically and policies see remapped nodes', () => {
  const source = createEditor({ nodes: [], edges: [] });
  const pattern = createArchitecturePattern('c4-context');
  for (const policy of [
    { canInsertPattern: () => 'Templates are protected.' },
    { canConnectPort: () => 'Port is closed.' },
    { canConnect: () => 'Connection is protected.' },
    { canInsertPattern: () => '' },
  ]) {
    const result = insertPattern(source, pattern, { policy });
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(source);
    if (result.type === 'blocked') expect(result.reason.trim().length).toBeGreaterThan(0);
  }
  const result = insertPattern(source, pattern, {
    policy: {
      canConnect: (edge, graph) => {
        expect(graph.nodes.some((node) => node.id === edge.source.node)).toBe(true);
        expect(graph.edges.some((item) => item.id === edge.id)).toBe(false);
        return null;
      },
      canSelectNode: () => 'Excluded',
    },
  });
  expect(result.type).toBe('inserted');
  expect(result.editor.selectedNodes).toEqual([]);
});

test('busy, read-only and disabled Undo block; empty fragments are unchanged; invalid fragments throw', () => {
  const initial = createEditor({ nodes: [], edges: [] });
  const pattern = createArchitecturePattern('ddd-aggregate');
  for (const state of [
    { ...initial, readOnly: true },
    { ...initial, historyLimit: 0 },
    updateEditor(initial, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } }),
  ]) {
    const result = insertPattern(state, pattern);
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(state);
  }
  expect(insertPattern(initial, { nodes: [], edges: [] })).toEqual({
    type: 'unchanged',
    editor: initial,
  });
  expect(() =>
    insertPattern(initial, {
      ...pattern,
      nodes: pattern.nodes.filter((node) => node.kind !== 'group'),
    }),
  ).toThrow();
  expect(() => insertPattern(initial, pattern, { offset: { x: Infinity, y: 0 } })).toThrow();
});

test('custom nested fragments avoid hostile ID collisions, detach JSON and preserve opaque strings', () => {
  const payload = { reference: 'source', nested: [1, 2] };
  const starter = createArchitecturePattern('ddd-aggregate');
  const outer = {
    ...starter.nodes[0]!,
    id: 'pattern:1',
    position: { x: -30, y: -40 },
    size: { width: 900, height: 500 },
  };
  const fragment = {
    nodes: [
      ...starter.nodes.map((node) => ({
        ...node,
        data: payload,
        ...(node.id === 'boundary' ? { parentId: outer.id } : { parentId: node.parentId! }),
      })),
      outer,
    ],
    edges: starter.edges.map((edge) => ({ ...edge, data: payload })),
  };
  const destination = createEditor({ nodes: [{ ...outer, id: 'pattern:2' }], edges: [] });
  const result = insertPattern(destination, fragment);
  expect(result.type).toBe('inserted');
  if (result.type !== 'inserted') throw new Error('Insertion rejected');
  expect(result.nodeIds.get('pattern:1')).not.toBe('pattern:1');
  expect([...result.nodeIds.values()]).not.toContain('pattern:2');
  const boundary = result.editor.graph.nodes.find(
    (node) => node.id === result.nodeIds.get('boundary'),
  )!;
  expect(boundary.parentId).toBe(result.nodeIds.get('pattern:1'));
  payload.nested.push(3);
  expect(boundary.data).toEqual({ reference: 'source', nested: [1, 2] });
  validateGraph(result.editor.graph);
});

test('a veto on a later connection rejects the whole batch without consuming history or Redo', () => {
  const starter = createArchitecturePattern('c4-context');
  const fragment = {
    nodes: [...starter.nodes, { ...starter.nodes[1]!, id: 'other', position: { x: 360, y: 300 } }],
    edges: [
      ...starter.edges,
      {
        ...starter.edges[0]!,
        id: 'second',
        label: 'Denied',
        target: { node: 'other', port: 'in' },
      },
    ],
  };
  const initial = createEditor({ nodes: [], edges: [] });
  const result = insertPattern(initial, fragment, {
    policy: {
      canConnect: (edge, graph) => {
        expect(graph.nodes).toHaveLength(3);
        expect(graph.edges).toHaveLength(1);
        return edge.label === 'Denied' ? 'Second connection is protected.' : null;
      },
    },
  });
  expect(result).toEqual({
    type: 'blocked',
    editor: initial,
    reason: 'Second connection is protected.',
  });
  expect(initial.past).toEqual([]);
  expect(initial.future).toEqual([]);
});
