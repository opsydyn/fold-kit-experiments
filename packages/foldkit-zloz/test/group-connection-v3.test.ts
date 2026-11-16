import { expect, test } from 'bun:test';

import {
  createGroupEditorV3,
  captureGroupDocumentV3,
  captureGroupEditorSourceV3,
  updateGroupEditorV3,
  planGroupConnectionV3,
  applyGroupConnectionV3,
  type ZlozGroupConnectionEditV3,
  type ZlozGroupEditorStateV3,
  type ZlozEdge,
} from '../src/index';
import wire from './fixtures/group-document-v3-ported.json';
const init = () =>
  createGroupEditorV3(captureGroupDocumentV3({ ...wire, graph: { ...wire.graph, edges: [] } }), {
    sessionId: 'connect-v3',
  });
const request = (editor: ZlozGroupEditorStateV3, edit: ZlozGroupConnectionEditV3) => ({
  source: captureGroupEditorSourceV3(editor),
  edit,
});
const edge = captureGroupDocumentV3(wire).graph.edges[0];
if (!edge) throw new Error('Missing literal boundary connection');
const create: ZlozGroupConnectionEditV3 = { operation: 'create', edges: [edge] };
const undo = (editor: ZlozGroupEditorStateV3) =>
  updateGroupEditorV3(editor, { type: 'UndoPressed', source: captureGroupEditorSourceV3(editor) });

test('v3 create preserves authored group endpoint and one full-document Undo', () => {
  const editor = init(),
    req = request(editor, create),
    plan = planGroupConnectionV3(editor, req);
  expect(plan.type).toBe('ready');
  expect(editor.revision).toBe(0);
  if (plan.type !== 'ready') throw new Error('Expected ready');
  expect(plan.createdEdges).toEqual([edge]);
  expect(plan.editor).toBe(editor);
  const result = applyGroupConnectionV3(editor, plan.request);
  expect(result.type).toBe('applied');
  expect(result.editor.document.graph.edges).toEqual([edge]);
  expect(result.editor.history.past).toEqual([editor.document]);
  expect(undo(result.editor).editor.document).toEqual(editor.document);
  expect(Object.isFrozen(plan.request.edit)).toBe(true);
});

test('create checks live port, whole-edge and operation policy; cached preview is not permission', () => {
  const editor = init(),
    req = request(editor, create),
    plan = planGroupConnectionV3(editor, req);
  if (plan.type !== 'ready') throw new Error('Expected ready');
  for (const policy of [
    { canConnectPort: () => 'Socket protected.' },
    { canConnect: () => 'Relation protected.' },
    { canCommitGroupDocumentV3: () => 'Model protected.' },
  ]) {
    const preview = planGroupConnectionV3(editor, req, policy),
      apply = applyGroupConnectionV3(editor, plan.request, policy);
    expect(preview.type).toBe('blocked');
    expect(apply.type).toBe('blocked');
    expect(apply.editor).toBe(editor);
  }
  let checks = 0;
  expect(
    applyGroupConnectionV3(editor, req, {
      canCommitGroupDocumentV3: () => {
        checks++;
        return null;
      },
    }).type,
  ).toBe('applied');
  expect(checks).toBe(1);
});

test('reconnect preserves edge identity/metadata and checks live reconnect and destination rules', () => {
  const document = captureGroupDocumentV3({
    ...wire,
    graph: {
      nodes: wire.graph.nodes.map((n) =>
        n.id === 'child'
          ? { ...n, ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }] }
          : n,
      ),
      edges: [{ ...edge, label: 'Boundary relation', data: { owner: 'systems' } }],
    },
  });
  const editor = createGroupEditorV3(document, { sessionId: 'reconnect-v3' });
  const req = request(editor, {
    operation: 'reconnect',
    edgeId: edge.id,
    end: 'target',
    endpoint: { node: 'child', port: 'in' },
  });
  const plan = planGroupConnectionV3(editor, req);
  expect(plan.type).toBe('ready');
  expect(
    applyGroupConnectionV3(editor, req, { canReconnect: () => 'Pinned endpoint.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Pinned endpoint.' });
  expect(
    applyGroupConnectionV3(editor, req, { canConnectPort: () => 'Target protected.' }).type,
  ).toBe('blocked');
  const result = applyGroupConnectionV3(editor, req);
  expect(result.editor.document.graph.edges[0]).toEqual({
    ...edge,
    label: 'Boundary relation',
    data: { owner: 'systems' },
    target: { node: 'child', port: 'in' },
  });
  expect(undo(result.editor).editor.document).toEqual(document);
  const same = request(result.editor, {
    operation: 'reconnect',
    edgeId: edge.id,
    end: 'target',
    endpoint: { node: 'child', port: 'in' },
  });
  expect(applyGroupConnectionV3(result.editor, same)).toEqual({
    type: 'unchanged',
    editor: result.editor,
  });
});

test('multi-connect is all-or-none, rejects duplicate IDs/pairs and preserves explicit ordering', () => {
  const document = captureGroupDocumentV3({
    ...wire,
    graph: {
      nodes: wire.graph.nodes.map((n) =>
        n.id === 'child'
          ? { ...n, ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }] }
          : n,
      ),
      edges: [],
    },
  });
  const editor = createGroupEditorV3(document, { sessionId: 'multi-v3' });
  const other = { id: 'second', source: edge.source, target: { node: 'child', port: 'in' } };
  const req = request(editor, { operation: 'create', edges: [edge, other] });
  const blocked = applyGroupConnectionV3(editor, req, {
    canConnect: (candidate) => (candidate.id === 'second' ? 'Second relation protected.' : null),
  });
  expect(blocked).toMatchObject({ type: 'blocked', reason: 'Second relation protected.' });
  expect(blocked.editor).toBe(editor);
  const allowed = applyGroupConnectionV3(editor, req);
  expect(allowed.editor.document.graph.edges).toEqual([edge, other]);
  expect(allowed.editor.history.past).toHaveLength(1);
  expect(undo(allowed.editor).editor.document).toEqual(document);
  expect(
    planGroupConnectionV3(editor, request(editor, { operation: 'create', edges: [edge, edge] }))
      .type,
  ).toBe('blocked');
  expect(
    planGroupConnectionV3(
      editor,
      request(editor, { operation: 'create', edges: [edge, { ...edge, id: 'duplicate-pair' }] }),
    ).type,
  ).toBe('blocked');
});

test('strict/loose eligibility and current source/lifecycle apply to previews and commits', () => {
  const editor = init();
  const reversed = { ...edge, source: edge.target, target: edge.source };
  expect(
    planGroupConnectionV3(editor, request(editor, { operation: 'create', edges: [reversed] })).type,
  ).toBe('blocked');
  const loose = createGroupEditorV3(
    { ...editor.document, connectionMode: 'loose' },
    { sessionId: 'loose-v3' },
  );
  const result = applyGroupConnectionV3(
    loose,
    request(loose, { operation: 'create', edges: [reversed] }),
  );
  expect(result.type).toBe('applied');
  expect(result.editor.document.connectionMode).toBe('loose');
  expect(undo(result.editor).editor.document).toEqual(loose.document);
  const req = request(editor, create),
    next = applyGroupConnectionV3(editor, req).editor;
  expect(planGroupConnectionV3(next, req)).toMatchObject({ type: 'blocked', code: 'stale-source' });
  for (const current of [
    { ...editor, readOnly: true },
    { ...editor, historyLimit: 0 },
    { ...editor, activity: { type: 'busy' as const, reason: 'Finish gesture.' } },
  ])
    expect(applyGroupConnectionV3(current, request(current, create)).editor).toBe(current);
});

test('invalid operations, unknown endpoints/edges and accessor input return explicit failures', () => {
  const editor = init();
  expect(
    planGroupConnectionV3(
      editor,
      request(editor, {
        operation: 'reconnect',
        edgeId: 'absent',
        end: 'source',
        endpoint: edge.source,
      }),
    ),
  ).toMatchObject({ type: 'blocked', code: 'not-found' });
  expect(
    planGroupConnectionV3(
      editor,
      request(editor, {
        operation: 'create',
        edges: [{ ...edge, target: { node: 'absent', port: 'in' } }],
      }),
    ).type,
  ).toBe('blocked');
  const bad = {
    operation: 'create' as const,
    get edges(): readonly ZlozEdge[] {
      throw new Error('Must not execute');
    },
  };
  expect(planGroupConnectionV3(editor, request(editor, bad))).toMatchObject({
    type: 'blocked',
    code: 'invalid-edit',
  });
  const extra = { ...create, force: true };
  expect(planGroupConnectionV3(editor, request(editor, extra))).toMatchObject({
    type: 'blocked',
    code: 'invalid-edit',
  });
  const plan = planGroupConnectionV3(editor, request(editor, create));
  if (plan.type !== 'ready') throw new Error('Expected ready');
  // @ts-expect-error Apply requires intent, not a cached arbitrary document target.
  expect(applyGroupConnectionV3(editor, plan.transaction).type).toBe('blocked');
});
