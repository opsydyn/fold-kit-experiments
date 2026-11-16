import { expect, test } from 'bun:test';

import { commitGraph } from '../src/editor';
import {
  applyGroupEditorTransactionV3,
  captureGroupDocumentV3,
  captureGroupEditorSourceV3,
  createGroupEditorV3,
  resolveGroupEditorBoundaryV3,
  serializeGroupDocumentV3,
  parseGroupDocumentV3,
  updateGroupEditorV3,
  updateEditor,
  createEditor,
  type ZlozGroupDocumentV3,
  type ZlozGroupEditorStateV3,
  type ZlozGroupEditorPolicyV3,
} from '../src/index';
import loose from './fixtures/group-document-v3-loose.json';
import ported from './fixtures/group-document-v3-ported.json';
import portless from './fixtures/group-document-v3-portless.json';
const init = (options = {}) =>
  createGroupEditorV3(captureGroupDocumentV3(ported), { sessionId: 'session-a', ...options });
const changed = (editor: ZlozGroupEditorStateV3) => ({
  ...editor.document,
  graph: {
    ...editor.document.graph,
    nodes: editor.document.graph.nodes.map((n) =>
      n.id === 'child' ? { ...n, label: 'Reviewed' } : n,
    ),
  },
});
const apply = (
  editor: ZlozGroupEditorStateV3,
  document: ZlozGroupDocumentV3 = changed(editor),
  policy: ZlozGroupEditorPolicyV3 = {},
) =>
  applyGroupEditorTransactionV3(
    editor,
    { source: captureGroupEditorSourceV3(editor), document },
    policy,
  );
const travel = (
  editor: ZlozGroupEditorStateV3,
  type: 'UndoPressed' | 'RedoPressed',
  policy: ZlozGroupEditorPolicyV3 = {},
) => updateGroupEditorV3(editor, { type, source: captureGroupEditorSourceV3(editor) }, policy);

test('explicit v3 initialization owns data, keeps the envelope and cannot be used as a legacy session', () => {
  const input = structuredClone(captureGroupDocumentV3(ported));
  const editor = createGroupEditorV3(input, { sessionId: 'new-incarnation' });
  Object.assign(input.graph.nodes[0]?.position ?? {}, { x: 999 });
  expect(editor.document.graph.nodes[0]!.position.x).toBe(140);
  expect(editor.document.capabilities.groupPorts).toBe(true);
  expect(editor.document.viewport).toEqual(ported.viewport);
  expect(editor.revision).toBe(0);
  expect(editor.history).toEqual({ past: [], future: [] });
  expect(Object.isFrozen(editor.document.graph.nodes[1]!.ports)).toBe(true);
  expect(Object.isFrozen(editor.history.past)).toBe(true);
  expect('graph' in editor).toBe(false);
  expect(() => createEditor(editor.document.graph)).toThrow();
  // @ts-expect-error v3 sessions are not legacy editors.
  expect(() => updateEditor(editor, { type: 'UndoPressed' })).toThrow('v3');
  // @ts-expect-error no version-erasing legacy commit of a v3 session.
  expect(() => commitGraph(editor, editor.document.graph)).toThrow('v3');
  for (const options of [
    { sessionId: '' },
    { sessionId: 'x', historyLimit: -1 },
    { sessionId: 'x', historyLimit: 1001 },
    { sessionId: 'x', historyLimit: 0.5 },
  ])
    expect(() => createGroupEditorV3(input, options)).toThrow();
  // @ts-expect-error runtime callers must also reject an old version.
  expect(() => createGroupEditorV3({ ...input, version: 2 }, { sessionId: 'x' })).toThrow();
});

test('one explicit world-coordinate movement yields one full-document Undo and Redo', () => {
  const editor = init();
  const target = {
    ...editor.document,
    viewport: { x: 8, y: 20, zoom: 2 },
    graph: {
      ...editor.document.graph,
      nodes: editor.document.graph.nodes.map((n) =>
        n.id === 'g' || n.parentId === 'g'
          ? { ...n, position: { x: n.position.x + 20, y: n.position.y + 30 } }
          : n,
      ),
    },
  };
  const result = apply(editor, target);
  expect(result.type).toBe('applied');
  expect(result.editor.document.graph.nodes[0]!.position).toEqual({ x: 160, y: 170 });
  expect(result.editor.document.graph.nodes[1]!.position).toEqual({ x: 120, y: 110 });
  expect(result.editor.document.graph.edges).toEqual(editor.document.graph.edges);
  expect(result.editor.history.past).toEqual([editor.document]);
  const undone = travel(result.editor, 'UndoPressed');
  expect(undone.type).toBe('applied');
  expect(undone.editor.document).toEqual(editor.document);
  expect(undone.editor.revision).toBe(2);
  expect(travel(undone.editor, 'RedoPressed').editor.document).toEqual(target);
  expect(serializeGroupDocumentV3(travel(undone.editor, 'RedoPressed').editor.document)).toContain(
    '"version":3',
  );
});

test('capability, mode and viewport belong to each history frame, including portless capability changes', () => {
  const editor = createGroupEditorV3(captureGroupDocumentV3(portless), { sessionId: 'cap' });
  const target = {
    ...editor.document,
    capabilities: { groupPorts: true },
    connectionMode: 'loose' as const,
    viewport: { x: 0, y: 0, zoom: 2 },
  };
  const result = apply(editor, target);
  expect(result.type).toBe('applied');
  const undo = travel(result.editor, 'UndoPressed');
  expect(undo.editor.document).toEqual(editor.document);
  expect(travel(undo.editor, 'RedoPressed').editor.document).toEqual(target);
  const withPorts = apply(result.editor, {
    ...target,
    graph: captureGroupDocumentV3(ported).graph,
  });
  expect(withPorts.type).toBe('applied');
  const undoPorts = travel(withPorts.editor, 'UndoPressed');
  expect(undoPorts.editor.document.capabilities.groupPorts).toBe(true);
  expect(travel(undoPorts.editor, 'RedoPressed').editor.document.graph).toEqual(
    captureGroupDocumentV3(ported).graph,
  );
  const looseEditor = createGroupEditorV3(captureGroupDocumentV3(loose), { sessionId: 'loose' });
  expect(apply(looseEditor, { ...looseEditor.document, connectionMode: 'strict' }).type).toBe(
    'blocked',
  );
});

test('stale/reused source and wrong session reject without consuming history', () => {
  const editor = init(),
    source = captureGroupEditorSourceV3(editor),
    result = apply(editor);
  for (const candidate of [
    result.editor,
    createGroupEditorV3(editor.document, { sessionId: 'other' }),
  ]) {
    const blocked = applyGroupEditorTransactionV3(candidate, {
      source,
      document: changed(candidate),
    });
    expect(blocked).toMatchObject({ type: 'blocked', code: 'stale-source' });
    expect(blocked.editor).toBe(candidate);
  }
  const drift = {
    ...editor,
    document: {
      ...editor.document,
      capabilities: { groupPorts: false },
      graph: { nodes: [], edges: [] },
    },
  };
  expect(applyGroupEditorTransactionV3(drift, { source, document: changed(editor) })).toMatchObject(
    { type: 'blocked', code: 'stale-source' },
  );
  const undo = travel(result.editor, 'UndoPressed').editor;
  expect(updateGroupEditorV3(undo, { type: 'RedoPressed', source })).toMatchObject({
    type: 'blocked',
    code: 'stale-source',
  });
});

test('no-op keeps references and Redo; history is bounded and branching clears future', () => {
  const original = init({ historyLimit: 2 });
  let editor = original;
  for (let i = 0; i < 3; i++)
    editor = apply(editor, { ...editor.document, viewport: { x: i, y: 0, zoom: 1 } }).editor;
  expect(editor.history.past).toHaveLength(2);
  editor = travel(editor, 'UndoPressed').editor;
  expect(apply(editor, editor.document)).toEqual({ type: 'unchanged', editor });
  expect(apply(editor, editor.document).editor).toBe(editor);
  expect(editor.history.future).toHaveLength(1);
  editor = apply(editor).editor;
  expect(editor.history.future).toHaveLength(0);
  expect(travel(editor, 'RedoPressed')).toEqual({ type: 'unchanged', editor });
  expect(travel(original, 'UndoPressed').editor).toBe(original);
});

test('live lifecycle, history and revision protections leave the original session untouched', () => {
  for (const editor of [
    init({ readOnly: true }),
    init({ historyLimit: 0 }),
    { ...init(), activity: { type: 'busy' as const, reason: 'Connection draft open.' } },
    { ...init(), revision: Number.MAX_SAFE_INTEGER },
  ]) {
    const result = apply(editor);
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(editor);
  }
  const edited = apply(init()).editor;
  for (const editor of [
    { ...edited, readOnly: true },
    { ...edited, historyLimit: 0 },
    { ...edited, activity: { type: 'busy' as const, reason: 'A gesture is active.' } },
    { ...edited, revision: Number.MAX_SAFE_INTEGER },
  ]) {
    expect(travel(editor, 'UndoPressed').type).toBe('blocked');
    expect(travel(editor, 'UndoPressed').editor).toBe(editor);
  }
});

test('invalid capability, dangling edges, ungrouping and lane/hotspot ports never publish partial documents', () => {
  const editor = init();
  const documents = [
    { ...editor.document, capabilities: { groupPorts: false } },
    {
      ...editor.document,
      graph: {
        ...editor.document.graph,
        nodes: editor.document.graph.nodes.filter((n) => n.id !== 'g'),
      },
    },
    {
      ...editor.document,
      graph: {
        ...editor.document.graph,
        nodes: editor.document.graph.nodes.map((n) =>
          n.id === 'g' ? { ...n, ports: [], kind: 'group' as const } : n,
        ),
      },
    },
    ...[
      { family: 'event-storming' as const, role: 'lane' as const },
      { family: 'event-storming' as const, role: 'hotspot' as const, status: 'open' as const },
    ].map((architecture) => ({
      ...editor.document,
      graph: {
        ...editor.document.graph,
        nodes: editor.document.graph.nodes.map((n) => (n.id === 'g' ? { ...n, architecture } : n)),
      },
    })),
  ];
  for (const document of documents) {
    const result = apply(editor, document);
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(editor);
  }
  const getter = {
    ...editor.document,
    get graph(): ZlozGroupDocumentV3['graph'] {
      throw new Error('Must not run');
    },
  };
  expect(apply(editor, getter)).toMatchObject({ type: 'blocked', code: 'invalid-document' });
});

test('descendant movement and resize vetoes are checked once against frozen complete source', () => {
  const editor = init(),
    visited: string[] = [];
  const target = {
    ...editor.document,
    graph: {
      ...editor.document.graph,
      nodes: editor.document.graph.nodes.map((n) =>
        n.id === 'g' || n.parentId === 'g'
          ? {
              ...n,
              position: { x: n.position.x + 10, y: n.position.y },
              size: { ...n.size, width: n.size.width + 10 },
            }
          : n,
      ),
    },
  };
  const result = apply(editor, target, {
    canMoveNode: (node, graph) => {
      visited.push(node.id);
      expect(Object.isFrozen(graph.nodes)).toBe(true);
      return node.id === 'g' ? 'Boundary locked.' : null;
    },
  });
  expect(result).toMatchObject({ type: 'blocked', reason: 'Boundary locked.' });
  expect(result.editor).toBe(editor);
  expect(visited).toEqual(['child', 'g']);
  expect(
    apply(editor, target, {
      canResizeNode: (n) => (n.id === 'child' ? 'Child size locked.' : null),
    }),
  ).toMatchObject({ type: 'blocked', reason: 'Child size locked.' });
});

test('group port/incident edge policies protect removal and Undo restores full boundary semantics', () => {
  const editor = init();
  const target = {
    ...editor.document,
    graph: {
      nodes: editor.document.graph.nodes.map((n) => (n.id === 'g' ? { ...n, ports: [] } : n)),
      edges: [],
    },
  };
  for (const policy of [
    { canEditPort: () => 'Port locked.' },
    { canDelete: () => 'Boundary relation locked.' },
  ]) {
    const result = apply(editor, target, policy);
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(editor);
  }
  const removed = apply(editor, target).editor;
  expect(removed.history.past).toHaveLength(1);
  expect(
    travel(removed, 'UndoPressed', { canConnectPort: () => 'Reconnection locked.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Reconnection locked.' });
  expect(
    travel(removed, 'UndoPressed', { canEditPort: () => 'Port recreation locked.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Port recreation locked.' });
  const restored = travel(removed, 'UndoPressed').editor;
  expect(restored.document).toEqual(editor.document);
  expect(
    travel(restored, 'RedoPressed', { canDelete: () => 'Deletion now locked.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Deletion now locked.' });
  const deleted = apply(
    editor,
    {
      ...editor.document,
      graph: { nodes: editor.document.graph.nodes.filter((n) => n.id === 'b'), edges: [] },
    },
    {
      canDelete: (c) => {
        expect(c.nodes.map((n) => n.id)).toEqual(['child', 'g']);
        expect(c.edges.map((e) => e.id)).toEqual(['boundary-link']);
        return null;
      },
    },
  );
  expect(deleted.type).toBe('applied');
});

test('whole-document live policy covers capability/mode/camera/data and applies to Undo and Redo', () => {
  const editor = init();
  const policy: ZlozGroupEditorPolicyV3 = {
    canCommitGroupDocumentV3: (candidate) => {
      expect(Object.isFrozen(candidate)).toBe(true);
      expect(Object.isFrozen(candidate.target.graph.nodes)).toBe(true);
      return `Protected ${candidate.operation}.`;
    },
  };
  expect(apply(editor, changed(editor), policy)).toMatchObject({
    type: 'blocked',
    reason: 'Protected apply.',
  });
  const after = apply(editor).editor;
  expect(travel(after, 'UndoPressed', policy)).toMatchObject({
    type: 'blocked',
    reason: 'Protected undo.',
  });
  const undo = travel(after, 'UndoPressed').editor;
  expect(travel(undo, 'RedoPressed', policy)).toMatchObject({
    type: 'blocked',
    reason: 'Protected redo.',
  });
  expect(() =>
    apply(editor, changed(editor), {
      canCommitGroupDocumentV3: () => {
        throw new Error('Host defect');
      },
    }),
  ).toThrow('Host defect');
  expect(editor.revision).toBe(0);
});

test('unsupported adapters and runtime native events report version-required without losing capability', () => {
  const editor = init();
  for (const operation of ['clipboard', 'mermaid', 'modelling-patch', 'review-packet'] as const) {
    expect(resolveGroupEditorBoundaryV3(editor, operation)).toMatchObject({
      type: 'blocked',
      code: 'version-required',
    });
    expect(resolveGroupEditorBoundaryV3(editor, operation).editor).toBe(editor);
  }
  expect(
    updateGroupEditorV3(editor, {
      // @ts-expect-error The session kernel accepts history events only; native events use the distinct workbench.
      type: 'CopyPressed',
      source: captureGroupEditorSourceV3(editor),
    }),
  ).toMatchObject({ type: 'blocked', code: 'version-required' });
  expect(parseGroupDocumentV3(serializeGroupDocumentV3(editor.document)).status).toBe('parsed');
});

test('ported ungrouping is blocked even when its proposed ordinary-node target is structurally valid', () => {
  const editor = init();
  const graph = {
    ...editor.document.graph,
    nodes: editor.document.graph.nodes.map((n) => {
      if (n.id === 'g') {
        const { kind: _kind, ...ordinary } = n;
        return ordinary;
      }
      if (n.parentId === 'g') {
        const { parentId: _parent, ...detached } = n;
        return detached;
      }
      return n;
    }),
  };
  const target = captureGroupDocumentV3({ ...editor.document, graph });
  expect(apply(editor, target)).toMatchObject({
    type: 'blocked',
    code: 'protected',
    reason: 'Handle shared ports and incident connections before changing group boundary kind.',
  });
});

test('Undo and Redo rerun live movement policy in both directions', () => {
  const editor = init();
  const moved = apply(editor, {
    ...editor.document,
    graph: {
      ...editor.document.graph,
      nodes: editor.document.graph.nodes.map((n) => ({
        ...n,
        position: { x: n.position.x + 10, y: n.position.y },
      })),
    },
  }).editor;
  const policy: ZlozGroupEditorPolicyV3 = {
    canMoveNode: (n) => (n.id === 'child' ? 'Descendant now locked.' : null),
  };
  expect(travel(moved, 'UndoPressed', policy)).toMatchObject({
    type: 'blocked',
    reason: 'Descendant now locked.',
  });
  const undone = travel(moved, 'UndoPressed').editor;
  expect(travel(undone, 'RedoPressed', policy)).toMatchObject({
    type: 'blocked',
    reason: 'Descendant now locked.',
  });
  expect(undone.history.future).toHaveLength(1);
});

test('source tokens reject accessors without invoking them', () => {
  const editor = init(),
    source = captureGroupEditorSourceV3(editor);
  let observed = false;
  const untrusted = {
    ...source,
    get document() {
      observed = true;
      return source.document;
    },
  };
  expect(
    applyGroupEditorTransactionV3(editor, { source: untrusted, document: changed(editor) }),
  ).toMatchObject({ type: 'blocked', code: 'invalid-document' });
  expect(observed).toBe(false);
});

test('adding group boundary semantics to an ordinary node can Undo and Redo atomically', () => {
  const target = captureGroupDocumentV3(ported);
  const initial = captureGroupDocumentV3({
    ...target,
    capabilities: { groupPorts: false },
    graph: {
      nodes: target.graph.nodes.map((n) => {
        if (n.id === 'g') {
          const { kind: _kind, ...ordinary } = n;
          return { ...ordinary, ports: [] };
        }
        if (n.parentId === 'g') {
          const { parentId: _parent, ...detached } = n;
          return detached;
        }
        return n;
      }),
      edges: [],
    },
  });
  const editor = createGroupEditorV3(initial, { sessionId: 'ordinary-to-group' });
  const applied = apply(editor, target);
  expect(applied.type).toBe('applied');
  const undone = travel(applied.editor, 'UndoPressed');
  expect(undone.type).toBe('applied');
  expect(undone.editor.document).toEqual(initial);
  expect(travel(undone.editor, 'RedoPressed').editor.document).toEqual(target);
});

test('ordinary-to-group promotion cannot create a transaction whose unchanged-port inverse is blocked', () => {
  const target = captureGroupDocumentV3(ported);
  const initial = captureGroupDocumentV3({
    ...target,
    capabilities: { groupPorts: false },
    graph: {
      ...target.graph,
      nodes: target.graph.nodes.map((n) => {
        if (n.id === 'g') {
          const { kind: _kind, ...ordinary } = n;
          return ordinary;
        }
        if (n.parentId === 'g') {
          const { parentId: _parent, ...detached } = n;
          return detached;
        }
        return n;
      }),
    },
  });
  const editor = createGroupEditorV3(initial, { sessionId: 'ported-kind-change' });
  expect(apply(editor, target)).toMatchObject({
    type: 'blocked',
    code: 'protected',
    reason: 'Handle shared ports and incident connections before changing group boundary kind.',
  });
  // Explicit port identity changes are reversible and pass removal/addition policy checks.
  const replacement = captureGroupDocumentV3({
    ...target,
    graph: {
      nodes: target.graph.nodes.map((n) =>
        n.id === 'g' ? { ...n, ports: n.ports.map((p) => ({ ...p, id: 'boundary-out' })) } : n,
      ),
      edges: target.graph.edges.map((e) => ({
        ...e,
        source: { ...e.source, port: 'boundary-out' },
      })),
    },
  });
  const applied = apply(editor, replacement);
  expect(applied.type).toBe('applied');
  const undone = travel(applied.editor, 'UndoPressed');
  expect(undone.type).toBe('applied');
  expect(undone.editor.document).toEqual(initial);
  expect(travel(undone.editor, 'RedoPressed').editor.document).toEqual(replacement);
});

test('source freshness includes capability, mode and camera even when the graph and revision match', () => {
  const editor = createGroupEditorV3(captureGroupDocumentV3(portless), {
    sessionId: 'envelope-drift',
  });
  const source = captureGroupEditorSourceV3(editor);
  for (const document of [
    { ...editor.document, capabilities: { groupPorts: true } },
    { ...editor.document, connectionMode: 'loose' as const },
    { ...editor.document, viewport: { x: 40, y: 20, zoom: 2 } },
  ]) {
    const current = { ...editor, document };
    const result = applyGroupEditorTransactionV3(current, { source, document: changed(current) });
    expect(result).toMatchObject({ type: 'blocked', code: 'stale-source' });
    expect(result.editor).toBe(current);
  }
});
