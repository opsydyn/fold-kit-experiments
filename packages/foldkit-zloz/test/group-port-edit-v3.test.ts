import { expect, test } from 'bun:test';

import {
  applyGroupPortEditV3,
  planGroupPortEditV3,
  captureGroupDocumentV3,
  captureGroupEditorSourceV3,
  createGroupEditorV3,
  updateGroupEditorV3,
  portPosition,
  type ZlozGroupPortEditV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorPolicyV3,
} from '../src/index';
import loose from './fixtures/group-document-v3-loose.json';
import ported from './fixtures/group-document-v3-ported.json';
import portless from './fixtures/group-document-v3-portless.json';
const init = () => createGroupEditorV3(captureGroupDocumentV3(ported), { sessionId: 'group-edit' });
const request = (editor: ZlozGroupEditorStateV3, edit: ZlozGroupPortEditV3) => ({
  source: captureGroupEditorSourceV3(editor),
  edit,
});
const label: ZlozGroupPortEditV3 = {
  operation: 'label',
  endpoint: { node: 'g', port: 'out' },
  label: 'Published events',
};
const add: ZlozGroupPortEditV3 = {
  operation: 'add',
  nodeId: 'g',
  port: { id: 'in', kind: 'input', side: 'left', anchor: { x: 0, y: 0.5 } },
};
const remove: ZlozGroupPortEditV3 = { operation: 'remove', endpoint: { node: 'g', port: 'out' } };
const group = (editor: ZlozGroupEditorStateV3) =>
  editor.document.graph.nodes.find((n) => n.id === 'g');
const travel = (
  editor: ZlozGroupEditorStateV3,
  type: 'UndoPressed' | 'RedoPressed',
  policy: ZlozGroupEditorPolicyV3 = {},
) => updateGroupEditorV3(editor, { type, source: captureGroupEditorSourceV3(editor) }, policy);

test('add previews owned complete data without publishing, appends identity and applies with one Undo', () => {
  const editor = init();
  const edit: ZlozGroupPortEditV3 = {
    operation: 'add',
    nodeId: 'g',
    port: {
      id: 'boundary-in',
      kind: 'input',
      side: 'left',
      anchor: { x: 0, y: 0.25 },
      label: 'Requests',
    },
  };
  const plan = planGroupPortEditV3(editor, request(editor, edit));
  expect(plan.type).toBe('ready');
  if (plan.type !== 'ready') throw new Error('Expected ready plan');
  expect(plan.editor).toBe(editor);
  expect(editor.revision).toBe(0);
  expect(editor.history.past).toHaveLength(0);
  expect(plan.removedEdges).toEqual([]);
  expect(plan.before).toBeNull();
  expect(plan.after?.id).toBe('boundary-in');
  expect(Object.isFrozen(plan.request.edit)).toBe(true);
  expect(Object.isFrozen(plan.transaction.document.graph.nodes)).toBe(true);
  Object.assign(edit.port.anchor ?? {}, { y: 0.9 });
  const result = applyGroupPortEditV3(editor, plan.request);
  expect(result.type).toBe('applied');
  expect(group(result.editor)?.ports.map((p) => p.id)).toEqual(['out', 'boundary-in']);
  expect(group(result.editor)?.ports[1]?.anchor).toEqual({ x: 0, y: 0.25 });
  expect(result.editor.document.graph.edges).toEqual(editor.document.graph.edges);
  expect(group(result.editor)?.position).toEqual(group(editor)?.position);
  expect(result.editor.document.viewport).toEqual(editor.document.viewport);
  expect(result.editor.history.past).toEqual([editor.document]);
  const undo = travel(result.editor, 'UndoPressed');
  expect(undo.editor.document).toEqual(editor.document);
  expect(travel(undo.editor, 'RedoPressed').editor.document).toEqual(result.editor.document);
});

test('label setting, empty label and explicit removal preserve identity and connection meaning', () => {
  const editor = init(),
    plan = planGroupPortEditV3(editor, request(editor, label));
  expect(plan.type).toBe('ready');
  if (plan.type !== 'ready') throw new Error('Expected ready plan');
  expect(plan.before?.label).toBeUndefined();
  expect(plan.after?.label).toBe('Published events');
  let next = applyGroupPortEditV3(editor, plan.request).editor;
  expect(next.document.graph.edges).toEqual(editor.document.graph.edges);
  next = applyGroupPortEditV3(next, request(next, { ...label, label: '' })).editor;
  expect(group(next)?.ports[0]?.label).toBe('');
  next = applyGroupPortEditV3(next, request(next, { ...label, label: null })).editor;
  expect(Object.hasOwn(group(next)?.ports[0] ?? {}, 'label')).toBe(false);
  expect(next.document.graph).toEqual(editor.document.graph);
});

test('position uses exact world anchor geometry and removes the previous coordinate representation', () => {
  const editor = init();
  let next = applyGroupPortEditV3(
    editor,
    request(editor, {
      operation: 'position',
      endpoint: { node: 'g', port: 'out' },
      position: { side: 'right', anchor: { x: 1, y: 0.25 } },
    }),
  ).editor;
  expect(group(next)?.ports[0]?.anchor).toEqual({ x: 1, y: 0.25 });
  expect(Object.hasOwn(group(next)?.ports[0] ?? {}, 'offset')).toBe(false);
  const node = group(next);
  if (!node) throw new Error('Expected group');
  expect(portPosition(node, 'out')).toEqual({ x: 500, y: 155 });
  expect(next.document.graph.edges).toEqual(editor.document.graph.edges);
  next = applyGroupPortEditV3(
    next,
    request(next, {
      operation: 'position',
      endpoint: { node: 'g', port: 'out' },
      position: { side: 'bottom', offset: 0.75 },
    }),
  ).editor;
  expect(Object.hasOwn(group(next)?.ports[0] ?? {}, 'anchor')).toBe(false);
  expect(group(next)?.ports[0]?.offset).toBe(0.75);
  expect(group(next)?.ports[0]?.side).toBe('bottom');
  expect(
    travel(next, 'UndoPressed').editor.document.graph.nodes.find((n) => n.id === 'g')?.ports[0]
      ?.anchor,
  ).toEqual({ x: 1, y: 0.25 });
});

test('removal previews every incident edge, preserves unrelated data and deletes in one reversible publication', () => {
  const document = captureGroupDocumentV3({
    ...ported,
    graph: {
      nodes: ported.graph.nodes.map((n) =>
        n.id === 'child'
          ? { ...n, ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }] }
          : n.id === 'b'
            ? {
                ...n,
                ports: [...n.ports, { id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
              }
            : n,
      ),
      edges: [
        ...ported.graph.edges,
        {
          id: 'child-link',
          source: { node: 'g', port: 'out' },
          target: { node: 'child', port: 'in' },
        },
        {
          id: 'unrelated',
          source: { node: 'b', port: 'out' },
          target: { node: 'child', port: 'in' },
        },
      ],
    },
  });
  const editor = createGroupEditorV3(document, { sessionId: 'incident-set' }),
    req = request(editor, remove);
  const policy: ZlozGroupEditorPolicyV3 = {
    canDelete: (candidate, graph) => {
      expect(candidate.nodes).toEqual([]);
      expect(candidate.edges.map((e) => e.id)).toEqual(['boundary-link', 'child-link']);
      expect(Object.isFrozen(candidate.edges)).toBe(true);
      expect(graph).toEqual(document.graph);
      return null;
    },
  };
  const plan = planGroupPortEditV3(editor, req, policy);
  expect(plan.type).toBe('ready');
  if (plan.type !== 'ready') throw new Error('Expected ready plan');
  expect(plan.removedEdges.map((e) => e.id)).toEqual(['boundary-link', 'child-link']);
  expect(plan.after).toBeNull();
  const result = applyGroupPortEditV3(editor, req, policy);
  expect(result.type).toBe('applied');
  expect(result.editor.history.past).toHaveLength(1);
  expect(result.editor.document.graph.edges.map((e) => e.id)).toEqual(['unrelated']);
  expect(group(result.editor)?.ports).toEqual([]);
  expect(result.editor.document.graph.nodes[0]).toEqual(document.graph.nodes[0]);
  const undo = travel(result.editor, 'UndoPressed');
  expect(undo.type).toBe('applied');
  expect(undo.editor.document).toEqual(document);
  expect(travel(undo.editor, 'RedoPressed').editor.document).toEqual(result.editor.document);
});

test('all four operations report live granular reasons, normalized blanks and whole-document vetoes', () => {
  const editor = init();
  const edits = [
    add,
    label,
    remove,
    {
      operation: 'position' as const,
      endpoint: { node: 'g', port: 'out' },
      position: { side: 'bottom' as const, offset: 0.5 },
    },
  ];
  for (const edit of edits) {
    const req = request(editor, edit);
    const policy: ZlozGroupEditorPolicyV3 = {
      canEditPort: (candidate, graph) => {
        expect(candidate.operation).toBe(edit.operation);
        expect(Object.isFrozen(candidate.port)).toBe(true);
        expect(Object.isFrozen(graph.nodes)).toBe(true);
        return 'Port protected.';
      },
    };
    expect(planGroupPortEditV3(editor, req, policy)).toMatchObject({
      type: 'blocked',
      reason: 'Port protected.',
    });
    const blocked = applyGroupPortEditV3(editor, req, policy);
    expect(blocked).toMatchObject({ type: 'blocked', reason: 'Port protected.' });
    expect(blocked.editor).toBe(editor);
    expect(planGroupPortEditV3(editor, req, { canEditPort: () => '  ' })).toMatchObject({
      type: 'blocked',
      reason: 'The graph change is protected.',
    });
    expect(
      planGroupPortEditV3(editor, req, { canCommitGroupDocumentV3: () => 'Workshop locked.' }),
    ).toMatchObject({ type: 'blocked', reason: 'Workshop locked.' });
  }
});

test('a protected incident edge vetoes the entire removal preview and Apply', () => {
  const editor = init(),
    req = request(editor, remove),
    policy: ZlozGroupEditorPolicyV3 = { canDelete: () => 'Boundary relation protected.' };
  expect(planGroupPortEditV3(editor, req, policy)).toMatchObject({
    type: 'blocked',
    reason: 'Boundary relation protected.',
  });
  const result = applyGroupPortEditV3(editor, req, policy);
  expect(result.editor).toBe(editor);
  expect(result.editor.revision).toBe(0);
  expect(result.editor.history.past).toEqual([]);
});

test('cached ready previews do not authorize Apply and policy defects propagate without mutation', () => {
  const editor = init(),
    req = request(editor, label);
  const plan = planGroupPortEditV3(editor, req);
  expect(plan.type).toBe('ready');
  if (plan.type !== 'ready') throw new Error('Expected ready plan');
  expect(
    applyGroupPortEditV3(editor, plan.request, { canEditPort: () => 'New protection.' }),
  ).toMatchObject({ type: 'blocked', reason: 'New protection.' });
  let calls = 0;
  const result = applyGroupPortEditV3(editor, plan.request, {
    canCommitGroupDocumentV3: () => {
      calls++;
      return null;
    },
  });
  expect(result.type).toBe('applied');
  expect(calls).toBe(1);
  expect(() =>
    applyGroupPortEditV3(editor, req, {
      canEditPort: () => {
        throw new Error('Policy defect');
      },
    }),
  ).toThrow('Policy defect');
  expect(editor.history.past).toHaveLength(0);
  // @ts-expect-error Apply accepts edit intent, never an arbitrary cached target.
  expect(applyGroupPortEditV3(editor, plan.transaction).type).toBe('blocked');
});

test('live source revision/session/envelope and lifecycle are checked by preview and Apply', () => {
  const editor = init(),
    req = request(editor, label),
    edited = applyGroupPortEditV3(editor, req).editor;
  const sessions = [
    edited,
    createGroupEditorV3(editor.document, { sessionId: 'other' }),
    { ...editor, document: { ...editor.document, connectionMode: 'loose' as const } },
    { ...editor, document: { ...editor.document, viewport: { x: 0, y: 0, zoom: 2 } } },
  ];
  for (const current of sessions) {
    expect(planGroupPortEditV3(current, req)).toMatchObject({
      type: 'blocked',
      code: 'stale-source',
    });
    expect(applyGroupPortEditV3(current, req).editor).toBe(current);
  }
  for (const current of [
    { ...editor, readOnly: true },
    { ...editor, activity: { type: 'busy' as const, reason: 'Finish dragging.' } },
    { ...editor, historyLimit: 0 },
    { ...editor, revision: Number.MAX_SAFE_INTEGER },
  ]) {
    const fresh = request(current, label);
    expect(planGroupPortEditV3(current, fresh).type).toBe('blocked');
    expect(applyGroupPortEditV3(current, fresh).editor).toBe(current);
  }
});

test('capability and group eligibility failures are visible without enabling or promoting anything', () => {
  const disabled = createGroupEditorV3(captureGroupDocumentV3(portless), { sessionId: 'disabled' });
  expect(planGroupPortEditV3(disabled, request(disabled, add))).toMatchObject({
    type: 'blocked',
    code: 'capability-disabled',
  });
  const editor = init();
  expect(planGroupPortEditV3(editor, request(editor, { ...add, nodeId: 'b' }))).toMatchObject({
    type: 'blocked',
    code: 'ineligible-group',
  });
  expect(planGroupPortEditV3(editor, request(editor, { ...add, nodeId: 'absent' }))).toMatchObject({
    type: 'blocked',
    code: 'not-found',
  });
  expect(
    planGroupPortEditV3(
      editor,
      request(editor, { ...label, endpoint: { node: 'g', port: 'absent' } }),
    ),
  ).toMatchObject({ type: 'blocked', code: 'not-found' });
  for (const architecture of [
    { family: 'event-storming', role: 'lane' },
    { family: 'event-storming', role: 'hotspot', status: 'open' },
  ]) {
    const source = captureGroupDocumentV3({
      ...ported,
      graph: {
        nodes: ported.graph.nodes.map((n) => {
          if (n.id === 'g') {
            const { kind: _kind, ...ordinary } = n;
            return architecture.role === 'hotspot'
              ? { ...ordinary, ports: [], architecture }
              : { ...n, ports: [], architecture };
          }
          if (architecture.role === 'hotspot' && n.parentId === 'g') {
            const { parentId: _parent, ...detached } = n;
            return detached;
          }
          return n;
        }),
        edges: [],
      },
    });
    const workshop = createGroupEditorV3(source, { sessionId: 'workshop' });
    expect(planGroupPortEditV3(workshop, request(workshop, add))).toMatchObject({
      type: 'blocked',
      code: 'ineligible-group',
    });
  }
  expect(disabled.document.capabilities.groupPorts).toBe(false);
});

test('malformed edits, duplicate identifiers and accessor fields return blocked without evaluating accessors', () => {
  const editor = init();
  expect(
    planGroupPortEditV3(editor, request(editor, { ...add, port: { ...add.port, id: 'out' } })),
  ).toMatchObject({ type: 'blocked', code: 'invalid-edit' });
  expect(
    // @ts-expect-error unsupported edit operations are also rejected for runtime callers.
    planGroupPortEditV3(editor, request(editor, { operation: 'enable', nodeId: 'g' })),
  ).toMatchObject({ type: 'blocked', code: 'invalid-edit' });
  expect(
    planGroupPortEditV3(
      editor,
      request(editor, {
        operation: 'position',
        endpoint: { node: 'g', port: 'out' },
        // @ts-expect-error position representations are exclusive.
        position: { side: 'right', offset: 0.5, anchor: { x: 1, y: 0.5 } },
      }),
    ).type,
  ).toBe('blocked');
  expect(
    planGroupPortEditV3(
      editor,
      request(editor, {
        operation: 'position',
        endpoint: { node: 'g', port: 'out' },
        position: { side: 'right', offset: 2 },
      }),
    ).type,
  ).toBe('blocked');
  let observed = false;
  const edit = {
    operation: 'label' as const,
    endpoint: { node: 'g', port: 'out' },
    get label() {
      observed = true;
      return 'Danger';
    },
  };
  expect(planGroupPortEditV3(editor, request(editor, edit))).toMatchObject({
    type: 'blocked',
    code: 'invalid-edit',
  });
  expect(observed).toBe(false);
  const extra = { ...add, ignored: 'never silently discard' };
  expect(planGroupPortEditV3(editor, request(editor, extra))).toMatchObject({
    type: 'blocked',
    code: 'invalid-edit',
  });
});

test('no-op retains Redo and object identity; a new actual edit branches history', () => {
  const editor = init(),
    changed = applyGroupPortEditV3(editor, request(editor, label)).editor;
  const undone = travel(changed, 'UndoPressed').editor;
  const same = request(undone, { ...label, label: null });
  expect(planGroupPortEditV3(undone, same).type).toBe('unchanged');
  expect(applyGroupPortEditV3(undone, same)).toEqual({ type: 'unchanged', editor: undone });
  expect(applyGroupPortEditV3(undone, same).editor).toBe(undone);
  expect(undone.history.future).toHaveLength(1);
  expect(applyGroupPortEditV3(undone, request(undone, add)).editor.history.future).toEqual([]);
});

test('Undo/Redo after planned edits rerun current port, connection and deletion protections', () => {
  const editor = init(),
    removed = applyGroupPortEditV3(editor, request(editor, remove)).editor;
  expect(
    travel(removed, 'UndoPressed', { canConnectPort: () => 'Connection protected.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Connection protected.' });
  expect(
    travel(removed, 'UndoPressed', { canEditPort: () => 'Port recreation protected.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Port recreation protected.' });
  const restored = travel(removed, 'UndoPressed').editor;
  expect(travel(restored, 'RedoPressed', { canDelete: () => 'Deletion protected.' })).toMatchObject(
    { type: 'blocked', reason: 'Deletion protected.' },
  );
  const added = applyGroupPortEditV3(editor, request(editor, add)).editor;
  expect(travel(added, 'UndoPressed', { canEditPort: () => 'Removal protected.' })).toMatchObject({
    type: 'blocked',
    reason: 'Removal protected.',
  });
});

test('loose connection meaning, capability, metadata and world coordinates survive an edit and travel', () => {
  const document = captureGroupDocumentV3({
      ...loose,
      graph: {
        ...loose.graph,
        nodes: loose.graph.nodes.map((n) => ({
          ...n,
          data: { owner: 'domain', provenance: { edition: 'baseline' } },
        })),
      },
    }),
    editor = createGroupEditorV3(document, { sessionId: 'loose-edit' });
  const node = document.graph.nodes.find((n) => n.kind === 'group');
  if (!node?.ports[0]) throw new Error('Expected loose group fixture');
  const result = applyGroupPortEditV3(
    editor,
    request(editor, {
      operation: 'label',
      endpoint: { node: node.id, port: node.ports[0].id },
      label: 'Shared endpoint',
    }),
  );
  expect(result.type).toBe('applied');
  expect(result.editor.document.connectionMode).toBe('loose');
  expect(result.editor.document.capabilities).toEqual(document.capabilities);
  expect(result.editor.document.graph.edges).toEqual(document.graph.edges);
  expect(result.editor.document.graph.nodes.map((n) => n.architecture)).toEqual(
    document.graph.nodes.map((n) => n.architecture),
  );
  expect(result.editor.document.graph.nodes.map((n) => n.data)).toEqual(
    document.graph.nodes.map((n) => n.data),
  );
  expect(result.editor.document.graph.nodes.map((n) => n.position)).toEqual(
    document.graph.nodes.map((n) => n.position),
  );
  expect(travel(result.editor, 'UndoPressed').editor.document).toEqual(document);
});

test('removal covers incoming loose connections and counts a self-loop only once', () => {
  const document = captureGroupDocumentV3({
    ...ported,
    connectionMode: 'loose',
    graph: {
      ...ported.graph,
      edges: [
        ...ported.graph.edges,
        { id: 'incoming', source: { node: 'b', port: 'in' }, target: { node: 'g', port: 'out' } },
        { id: 'self-loop', source: { node: 'g', port: 'out' }, target: { node: 'g', port: 'out' } },
      ],
    },
  });
  const editor = createGroupEditorV3(document, { sessionId: 'incoming-and-loop' });
  const plan = planGroupPortEditV3(editor, request(editor, remove));
  expect(plan.type).toBe('ready');
  if (plan.type !== 'ready') throw new Error('Expected ready plan');
  expect(plan.removedEdges.map((e) => e.id)).toEqual(['boundary-link', 'incoming', 'self-loop']);
  const next = applyGroupPortEditV3(editor, plan.request).editor;
  expect(next.document.graph.edges).toEqual([]);
  expect(next.history.past).toHaveLength(1);
  expect(travel(next, 'UndoPressed').editor.document).toEqual(document);
});
