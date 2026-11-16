import { expect, test } from 'bun:test';

import {
  createGroupEditorV3,
  captureGroupDocumentV3,
  groupLayoutRequestV3,
  applyGroupLayoutV3,
  captureGroupEditorSourceV3,
  updateGroupEditorV3,
  portPosition,
  createGroupWorkbenchV3,
  applyGroupWorkbenchLayoutV3,
  groupWorkbenchRoutesV3,
  updateGroupWorkbenchV3,
  type LayoutResult,
} from '../src/index';
import wire from './fixtures/group-document-v3-ported.json';
const init = () => createGroupEditorV3(captureGroupDocumentV3(wire), { sessionId: 'layout-v3' });
const resultFor = (request: ReturnType<typeof groupLayoutRequestV3>) => ({
  version: 3 as const,
  requestId: request.requestId,
  revision: request.source.revision,
  positions: request.source.document.graph.nodes.map((n): LayoutResult['positions'][number] => ({
    id: n.id,
    x: n.position.x + 10,
    y: n.position.y + 20,
  })),
  routes: request.source.document.graph.edges.map((e) => ({
    id: e.id,
    points: [e.source, e.target].map((endpoint) => {
      const node = request.source.document.graph.nodes.find((n) => n.id === endpoint.node)!;
      return portPosition(
        { ...node, position: { x: node.position.x + 10, y: node.position.y + 20 } },
        endpoint.port,
      );
    }),
  })),
});
test('native v3 layout preserves authored fields and publishes all geometry as one Undo', () => {
  const editor = init(),
    request = groupLayoutRequestV3(editor, 'first'),
    result = resultFor(request);
  const next = applyGroupLayoutV3(editor, request, result);
  expect(next.type).toBe('applied');
  expect(next.editor.document).toEqual({
    ...editor.document,
    graph: {
      ...editor.document.graph,
      nodes: editor.document.graph.nodes.map((n) => ({
        ...n,
        position: { x: n.position.x + 10, y: n.position.y + 20 },
      })),
    },
  });
  expect(next.editor.history.past).toHaveLength(1);
  expect(
    updateGroupEditorV3(next.editor, {
      type: 'UndoPressed',
      source: captureGroupEditorSourceV3(next.editor),
    }).editor.document,
  ).toEqual(editor.document);
});
test('native layout rejects superseded requests, changed sessions/documents and current protections without mutation', () => {
  const editor = init(),
    request = groupLayoutRequestV3(editor, 'first'),
    result = resultFor(request);
  expect(applyGroupLayoutV3(editor, groupLayoutRequestV3(editor, 'second'), result)).toMatchObject({
    type: 'blocked',
    editor,
  });
  expect(
    applyGroupLayoutV3({ ...editor, sessionId: 'replacement' }, request, result),
  ).toMatchObject({ type: 'blocked', code: 'stale-source' });
  expect(applyGroupLayoutV3({ ...editor, readOnly: true }, request, result)).toMatchObject({
    type: 'blocked',
    code: 'read-only',
  });
  expect(
    applyGroupLayoutV3(
      { ...editor, activity: { type: 'busy', reason: 'Workshop busy.' } },
      request,
      result,
    ),
  ).toMatchObject({ type: 'blocked', reason: 'Workshop busy.' });
  expect(
    applyGroupLayoutV3(editor, request, result, { canMoveNode: () => 'Pinned now.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Pinned now.', editor });
  const changed = applyGroupLayoutV3(editor, request, result).editor;
  expect(applyGroupLayoutV3(changed, request, result)).toMatchObject({
    type: 'blocked',
    code: 'stale-source',
    editor: changed,
  });
});
test('invalid or partial layout geometry cannot enter v3 history', () => {
  const editor = init(),
    request = groupLayoutRequestV3(editor, 'bad'),
    result = resultFor(request);
  for (const invalid of [
    { ...result, positions: result.positions.slice(1) },
    { ...result, positions: [...result.positions, result.positions[0]!] },
    { ...result, positions: result.positions.map((n) => ({ ...n, x: NaN })) },
    {
      ...result,
      positions: result.positions.map((n) => (n.id === 'child' ? { ...n, x: 10000 } : n)),
    },
  ]) {
    expect(applyGroupLayoutV3(editor, request, invalid)).toMatchObject({
      type: 'blocked',
      code: 'invalid-document',
      editor,
    });
  }
});

test('native result decoding rejects missing/duplicate/foreign routes, wrong anchors, unexpected labels and accessor data', () => {
  const editor = init(),
    request = groupLayoutRequestV3(editor, 'routes'),
    result = resultFor(request);
  const route = result.routes[0]!;
  for (const bad of [
    { ...result, routes: [] },
    { ...result, routes: [route, route] },
    { ...result, routes: [{ ...route, id: 'foreign' }] },
    {
      ...result,
      routes: [
        {
          ...route,
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      ],
    },
    {
      ...result,
      routes: [{ ...route, label: { position: { x: 1, y: 2 }, size: { width: 100, height: 20 } } }],
    },
    {
      ...result,
      positions: result.positions.map((n) => ({ ...n, size: { width: 10, height: 10 } })),
    },
  ])
    expect(applyGroupLayoutV3(editor, request, bad)).toMatchObject({
      type: 'blocked',
      code: 'invalid-document',
      editor,
    });
  let accessed = false;
  const getter = {
    ...result,
    get positions() {
      accessed = true;
      return result.positions;
    },
  };
  expect(applyGroupLayoutV3(editor, request, getter)).toMatchObject({
    type: 'blocked',
    code: 'invalid-document',
    editor,
  });
  expect(accessed).toBe(false);
  // @ts-expect-error An engine can violate its compile-time result contract at runtime.
  expect(applyGroupLayoutV3(editor, request, { version: 3 })).toMatchObject({
    type: 'blocked',
    code: 'invalid-document',
    editor,
  });
});
test('group resize constraints and live resize/commit policies veto the entire layout; policy defects propagate', () => {
  const editor = init(),
    request = groupLayoutRequestV3(editor, 'resize');
  const result = resultFor(request);
  result.positions = result.positions.map((p) =>
    p.id === 'g' ? { ...p, size: { width: 450, height: 350 } } : p,
  );
  const group = result.positions.find((p) => p.id === 'g')!;
  result.routes = [
    {
      id: 'boundary-link',
      points: [{ x: group.x + 450, y: group.y + 175 }, result.routes[0]!.points.at(-1)!],
    },
  ];
  expect(
    applyGroupLayoutV3(editor, request, result, { canResizeNode: () => 'Boundary locked.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Boundary locked.', editor });
  expect(
    applyGroupLayoutV3(editor, request, result, {
      canCommitGroupDocumentV3: () => 'Review required.',
    }),
  ).toMatchObject({ type: 'blocked', reason: 'Review required.', editor });
  expect(() =>
    applyGroupLayoutV3(editor, request, result, {
      canMoveNode: () => {
        throw new Error('Policy defect');
      },
    }),
  ).toThrow('Policy defect');
  const locked = createGroupEditorV3(
    captureGroupDocumentV3({
      ...wire,
      graph: {
        ...wire.graph,
        nodes: wire.graph.nodes.map((n) =>
          n.id === 'g' ? { ...n, resizeLimits: { maxWidth: 420 } } : n,
        ),
      },
    }),
    { sessionId: 'limits' },
  );
  const limitedRequest = groupLayoutRequestV3(locked, 'resize');
  expect(
    applyGroupLayoutV3(locked, limitedRequest, { ...result, requestId: 'resize' }),
  ).toMatchObject({
    type: 'blocked',
    reason: expect.stringContaining('resize limits'),
    editor: locked,
  });
});
test('complete document changes at the same revision cannot reuse a pending layout', () => {
  const editor = init(),
    request = groupLayoutRequestV3(editor, 'source'),
    result = resultFor(request);
  for (const document of [
    captureGroupDocumentV3({ ...editor.document, connectionMode: 'loose' }),
    captureGroupDocumentV3({ ...editor.document, viewport: { x: 0, y: 0, zoom: 2 } }),
    captureGroupDocumentV3({
      ...editor.document,
      graph: {
        ...editor.document.graph,
        nodes: editor.document.graph.nodes.map((n) => ({ ...n, label: 'Changed metadata' })),
      },
    }),
  ])
    expect(applyGroupLayoutV3({ ...editor, document }, request, result)).toMatchObject({
      type: 'blocked',
      code: 'stale-source',
    });
});
test('workbench retains accepted routes only for matching idle uncollapsed geometry, and Undo clears them', () => {
  const model = createGroupWorkbenchV3(captureGroupDocumentV3(wire), {
      sessionId: 'routes-native',
    }),
    request = groupLayoutRequestV3(model.editor, 'workbench'),
    result = resultFor(request);
  const next = applyGroupWorkbenchLayoutV3(model, request, result);
  expect(groupWorkbenchRoutesV3(next)).toEqual(result.routes);
  expect(next.viewport).toEqual(model.viewport);
  expect(groupWorkbenchRoutesV3({ ...next, collapsedGroupIds: ['g'] })).toEqual([]);
  const moving = updateGroupWorkbenchV3(next, {
    type: 'NodeDragStarted',
    id: 'g',
    pointer: 1,
    point: { x: 100, y: 100 },
  });
  expect(groupWorkbenchRoutesV3(moving)).toEqual([]);
  expect(applyGroupWorkbenchLayoutV3(moving, request, result).editor).toBe(next.editor);
  const undone = updateGroupWorkbenchV3(next, { type: 'UndoPressed' });
  expect(undone.editor.document).toEqual(model.editor.document);
  expect(groupWorkbenchRoutesV3(undone)).toEqual([]);
});
test('identical layout geometry retains routes without manufacturing an Undo frame', () => {
  const model = createGroupWorkbenchV3(captureGroupDocumentV3(wire), { sessionId: 'no-op-layout' }),
    request = groupLayoutRequestV3(model.editor, 'same');
  const result = {
    version: 3 as const,
    requestId: request.requestId,
    revision: 0,
    positions: wire.graph.nodes.map((n) => ({ id: n.id, ...n.position })),
    routes: wire.graph.edges.map((e) => ({
      id: e.id,
      points: [e.source, e.target].map((endpoint) =>
        portPosition(
          model.editor.document.graph.nodes.find((n) => n.id === endpoint.node)!,
          endpoint.port,
        ),
      ),
    })),
  };
  const next = applyGroupWorkbenchLayoutV3(model, request, result);
  expect(next.editor).toBe(model.editor);
  expect(next.editor.history.past).toEqual([]);
  expect(groupWorkbenchRoutesV3(next)).toEqual(result.routes);
  expect(next.status).toContain('No Undo frame added');
});
