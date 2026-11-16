import { expect, test } from 'bun:test';

import {
  captureGroupDocumentV3,
  createGroupEditorV3,
  groupLayoutRequestV3,
  applyGroupLayoutV3,
  updateGroupEditorV3,
  captureGroupEditorSourceV3,
  portPosition,
} from '@opsydyn/foldkit-zloz';

import { createElkGroupLayoutV3, createElkLayout } from '../src/index';
const document = captureGroupDocumentV3({
  version: 3,
  coordinateSpace: 'world',
  connectionMode: 'strict',
  capabilities: { groupPorts: true },
  viewport: { x: 10, y: 20, zoom: 1 },
  graph: {
    nodes: [
      {
        id: 'outer',
        kind: 'group',
        label: 'Outer',
        position: { x: 50, y: 50 },
        size: { width: 600, height: 500 },
        ports: [
          { id: 'out', kind: 'output', side: 'right', offset: 0.7 },
          { id: 'in', kind: 'input', side: 'left', offset: 0.25 },
        ],
      },
      {
        id: 'inner',
        kind: 'group',
        parentId: 'outer',
        label: 'Inner',
        position: { x: 100, y: 150 },
        size: { width: 300, height: 250 },
        ports: [{ id: 'out', kind: 'output', side: 'bottom', offset: 0.3 }],
      },
      {
        id: 'child',
        parentId: 'inner',
        label: 'Child',
        position: { x: 130, y: 220 },
        size: { width: 150, height: 80 },
        ports: [
          { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
          { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
        ],
      },
      {
        id: 'external',
        label: 'External',
        position: { x: 800, y: 150 },
        size: { width: 180, height: 100 },
        ports: [{ id: 'in', kind: 'input', side: 'left', anchor: { x: 0.1, y: 0.8 } }],
      },
    ],
    edges: [
      {
        id: 'group-to-external',
        source: { node: 'outer', port: 'out' },
        target: { node: 'external', port: 'in' },
        data: { retained: 'yes' },
      },
      {
        id: 'nested-to-external',
        source: { node: 'inner', port: 'out' },
        target: { node: 'external', port: 'in' },
      },
      {
        id: 'group-to-child',
        source: { node: 'outer', port: 'out' },
        target: { node: 'child', port: 'in' },
      },
      {
        id: 'child-to-external',
        source: { node: 'child', port: 'out' },
        target: { node: 'external', port: 'in' },
      },
    ],
  },
});
for (const direction of ['RIGHT', 'DOWN'] as const)
  test(`real native v3 ${direction} ELK retains nested group ports and one Undo`, async () => {
    const editor = createGroupEditorV3(document, { sessionId: 'real-v3' }),
      request = groupLayoutRequestV3(editor, direction),
      before = JSON.stringify(request);
    const result = await createElkGroupLayoutV3({ direction })(request);
    const applied = applyGroupLayoutV3(editor, request, result);
    expect(applied.type).toBe('applied');
    if (applied.type === 'blocked') throw new Error(applied.reason);
    expect(JSON.stringify(request)).toBe(before);
    expect(applied.editor.document.graph.edges).toEqual(document.graph.edges);
    expect(applied.editor.document.graph.nodes.map((n) => n.ports)).toEqual(
      document.graph.nodes.map((n) => n.ports),
    );
    for (const node of applied.editor.document.graph.nodes) {
      if (!node.parentId) continue;
      const parent = applied.editor.document.graph.nodes.find((n) => n.id === node.parentId)!;
      expect(node.position.x).toBeGreaterThanOrEqual(parent.position.x);
      expect(node.position.y).toBeGreaterThanOrEqual(parent.position.y + 52);
      expect(node.position.x + node.size.width).toBeLessThanOrEqual(
        parent.position.x + parent.size.width + 1e-6,
      );
      expect(node.position.y + node.size.height).toBeLessThanOrEqual(
        parent.position.y + parent.size.height + 1e-6,
      );
    }
    for (const edge of document.graph.edges) {
      const route = result.routes.find((r) => r.id === edge.id)!;
      expect(route.points[0]).toEqual(
        portPosition(
          applied.editor.document.graph.nodes.find((n) => n.id === edge.source.node)!,
          edge.source.port,
        ),
      );
      expect(route.points.at(-1)).toEqual(
        portPosition(
          applied.editor.document.graph.nodes.find((n) => n.id === edge.target.node)!,
          edge.target.port,
        ),
      );
    }
    expect(applied.editor.history.past).toHaveLength(1);
    expect(
      updateGroupEditorV3(applied.editor, {
        type: 'UndoPressed',
        source: captureGroupEditorSourceV3(applied.editor),
      }).editor.document,
    ).toEqual(editor.document);
  });
test('native engine failures propagate and the legacy adapter still refuses ported groups', async () => {
  const editor = createGroupEditorV3(document, { sessionId: 'fail' }),
    request = groupLayoutRequestV3(editor, 'failure'),
    error = new Error('Worker failed');
  await expect(
    createElkGroupLayoutV3({ elk: { layout: () => Promise.reject(error) } })(request),
  ).rejects.toBe(error);
  await expect(
    createElkLayout()({ requestId: 'legacy', revision: 0, graph: document.graph }),
  ).rejects.toThrow();
});
test('empty, disconnected and loose native documents retain explicit modes and port directions', async () => {
  for (const input of [
    captureGroupDocumentV3({ ...document, graph: { nodes: [], edges: [] } }),
    captureGroupDocumentV3({ ...document, graph: { ...document.graph, edges: [] } }),
    captureGroupDocumentV3({
      ...document,
      connectionMode: 'loose',
      graph: {
        ...document.graph,
        edges: [
          {
            id: 'loose',
            source: { node: 'outer', port: 'in' },
            target: { node: 'external', port: 'in' },
          },
        ],
      },
    }),
  ]) {
    const editor = createGroupEditorV3(input, { sessionId: 'variants' }),
      request = groupLayoutRequestV3(editor, 'variant');
    const result = await createElkGroupLayoutV3()(request),
      applied = applyGroupLayoutV3(editor, request, result);
    expect(applied.type).not.toBe('blocked');
    expect(applied.editor.document.connectionMode).toBe(input.connectionMode);
    expect(applied.editor.document.graph.edges).toEqual(input.graph.edges);
    expect(applied.editor.document.capabilities).toEqual(input.capabilities);
  }
});
test('native group header and label hints reserve space and a live boundary-size veto blocks the whole result', async () => {
  const editor = createGroupEditorV3(document, { sessionId: 'hints' }),
    request = groupLayoutRequestV3(editor, 'hinted', {
      groupHeaders: [
        {
          id: 'outer',
          size: { width: 700, height: 120 },
          padding: { top: 20, left: 20, right: 20, bottom: 20 },
          gap: 12,
        },
      ],
      edgeLabels: document.graph.edges.map((e) => ({ id: e.id, size: { width: 160, height: 32 } })),
    });
  const result = await createElkGroupLayoutV3({ direction: 'DOWN' })(request),
    applied = applyGroupLayoutV3(editor, request, result);
  expect(applied.type).toBe('applied');
  if (applied.type === 'blocked') throw new Error(applied.reason);
  expect(
    applied.editor.document.graph.nodes.find((n) => n.id === 'outer')!.size.width,
  ).toBeGreaterThanOrEqual(740);
  expect(result.routes.every((r) => r.label?.size.width === 160)).toBe(true);
  expect(
    applyGroupLayoutV3(editor, request, result, {
      canResizeNode: () => 'Boundary reviewed size is fixed.',
    }),
  ).toMatchObject({ type: 'blocked', editor, reason: 'Boundary reviewed size is fixed.' });
});
