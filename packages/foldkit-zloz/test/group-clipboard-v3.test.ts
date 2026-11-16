import { expect, test } from 'bun:test';

import {
  applyGroupPasteV3,
  copyGroupSelectionV3,
  groupPasteRequestV3,
  planGroupPasteV3,
} from '../src/group-clipboard-v3';
import { captureGroupDocumentV3 } from '../src/group-document-v3';
import {
  captureGroupEditorSourceV3,
  createGroupEditorV3,
  updateGroupEditorV3,
} from '../src/group-editor-v3';
import wire from './fixtures/group-document-v3-ported.json';
const init = () => createGroupEditorV3(captureGroupDocumentV3(wire), { sessionId: 'clipboard' });
const copy = (ids = ['g', 'b']) => {
  const result = copyGroupSelectionV3(init(), ids);
  if (result.type !== 'copied') throw new Error('Expected copied fragment');
  return result;
};
test('copy includes descendants once, retains native sockets and discloses detached parents and omitted boundary connections', () => {
  const editor = init(),
    result = copyGroupSelectionV3(editor, ['g', 'child']);
  expect(result.type).toBe('copied');
  if (result.type !== 'copied') throw new Error('Expected copied');
  expect(result.clipboard.document.graph.nodes.map((n) => n.id)).toEqual(['child', 'g']);
  expect(result.rootNodeIds).toEqual(['g']);
  expect(result.clipboard.document.graph.nodes[1]?.ports[0]?.id).toBe('out');
  expect(result.clipboard.document.graph.edges).toEqual([]);
  expect(result.findings).toEqual([
    { code: 'boundary-edge-omitted', id: 'boundary-link', reason: expect.any(String) },
  ]);
  expect(result.clipboard.document.viewport).toBeUndefined();
  const detached = copyGroupSelectionV3(editor, ['child']);
  expect(detached.type).toBe('copied');
  if (detached.type !== 'copied') throw new Error('Expected detached');
  expect(detached.clipboard.document.graph.nodes[0]?.parentId).toBeUndefined();
  expect(detached.findings[0]).toMatchObject({ code: 'parent-detached', id: 'child' });
  expect(editor.history.past).toEqual([]);
  expect(editor.revision).toBe(0);
  expect(Object.isFrozen(result.clipboard.document.graph.nodes)).toBe(true);
  expect(copyGroupSelectionV3({ ...editor, readOnly: true }, ['g']).type).toBe('copied');
  expect(
    copyGroupSelectionV3(editor, ['g'], { canCopyGroupFragmentV3: () => 'Confidential boundary.' }),
  ).toMatchObject({ type: 'blocked', reason: 'Confidential boundary.' });
});
test('paste explicitly remaps owners, ports, edges and parent membership; one Undo restores the entire target', () => {
  const editor = init(),
    copied = copy(),
    request = groupPasteRequestV3(editor, copied.clipboard, { offset: { x: 40, y: 60 } });
  const plan = planGroupPasteV3(editor, request);
  expect(plan.type).toBe('ready');
  if (plan.type !== 'ready') throw new Error('Expected ready');
  expect(plan.rootNodeIds).toHaveLength(2);
  expect(plan.transaction.document.connectionMode).toBe('strict');
  expect(plan.transaction.document.capabilities).toEqual({ groupPorts: true });
  const result = applyGroupPasteV3(editor, plan.request);
  expect(result.type).toBe('applied');
  const pasted = result.editor.document.graph.nodes.slice(3),
    group = pasted.find((n) => n.kind === 'group')!,
    child = pasted.find((n) => n.label === 'Child')!,
    other = pasted.find((n) => n.label === 'Other system')!;
  expect(child.parentId).toBe(group.id);
  expect(child.position).toEqual({ x: 180, y: 200 });
  expect(group.ports[0]?.id).not.toBe('out');
  expect(result.editor.document.graph.edges[1]).toMatchObject({
    source: { node: group.id, port: group.ports[0]!.id },
    target: { node: other.id, port: other.ports[0]!.id },
  });
  expect(result.editor.document.viewport).toEqual(editor.document.viewport);
  expect(result.editor.history.past).toHaveLength(1);
  expect(
    updateGroupEditorV3(result.editor, {
      type: 'UndoPressed',
      source: captureGroupEditorSourceV3(result.editor),
    }).editor.document,
  ).toEqual(editor.document);
  const again = applyGroupPasteV3(
    result.editor,
    groupPasteRequestV3(result.editor, copied.clipboard, { offset: { x: 80, y: 120 } }),
  );
  expect(again.type).toBe('applied');
  expect(new Set(again.editor.document.graph.nodes.map((n) => n.id)).size).toBe(9);
});
test('custom identity maps are exact and target collisions, omissions, aliases and invalid geometry reject atomically', () => {
  const editor = init(),
    request = groupPasteRequestV3(editor, copy().clipboard, { offset: { x: 0, y: 0 } });
  const custom = {
    ...request,
    identities: {
      ...request.identities,
      nodes: request.identities.nodes.map((m) => ({ ...m, to: 'designer:' + m.from })),
    },
  };
  expect(
    applyGroupPasteV3(editor, custom).editor.document.graph.nodes.some(
      (n) => n.id === 'designer:g',
    ),
  ).toBe(true);
  for (const identities of [
    { ...request.identities, nodes: request.identities.nodes.slice(1) },
    {
      ...request.identities,
      nodes: request.identities.nodes.map((m) => ({ ...m, to: 'collision' })),
    },
    {
      ...request.identities,
      nodes: request.identities.nodes.map((m) => ({ ...m, to: m.from === 'g' ? 'b' : m.to })),
    },
    { ...request.identities, ports: [] },
    {
      ...request.identities,
      ports: [...request.identities.ports, { nodeId: 'ghost', from: 'out', to: 'fake' }],
    },
  ]) {
    const result = applyGroupPasteV3(editor, { ...request, identities });
    expect(result.type).toBe('blocked');
    expect(result.editor).toBe(editor);
  }
  expect(applyGroupPasteV3(editor, { ...request, offset: { x: Infinity, y: 0 } })).toMatchObject({
    type: 'blocked',
    code: 'invalid-edit',
  });
});
test('current source, protections, lifecycle, mode and capability are checked again at Apply', () => {
  const editor = init(),
    request = groupPasteRequestV3(editor, copy().clipboard, { offset: { x: 20, y: 20 } });
  expect(planGroupPasteV3(editor, request).type).toBe('ready');
  for (const policy of [
    { canEditPort: () => 'Interface frozen.' },
    { canConnectPort: () => 'Endpoint frozen.' },
    { canConnect: () => 'Relationship frozen.' },
    { canCommitGroupDocumentV3: () => 'Workshop frozen.' },
  ]) {
    const result = applyGroupPasteV3(editor, request, policy);
    expect(result).toMatchObject({ type: 'blocked', code: 'protected' });
    expect(result.editor).toBe(editor);
  }
  for (const changed of [
    { ...editor, revision: 1 },
    { ...editor, sessionId: 'replacement' },
  ])
    expect(applyGroupPasteV3(changed, request)).toMatchObject({
      type: 'blocked',
      code: 'stale-source',
    });
  expect(applyGroupPasteV3({ ...editor, readOnly: true }, request)).toMatchObject({
    type: 'blocked',
    code: 'read-only',
  });
  expect(
    applyGroupPasteV3(
      { ...editor, activity: { type: 'busy', reason: 'Gesture active.' } },
      request,
    ),
  ).toMatchObject({ type: 'blocked', code: 'busy' });
  expect(applyGroupPasteV3({ ...editor, historyLimit: 0 }, request)).toMatchObject({
    type: 'blocked',
    code: 'history-disabled',
  });
  const loose = createGroupEditorV3(
    { ...editor.document, connectionMode: 'loose' },
    { sessionId: 'loose' },
  );
  expect(
    applyGroupPasteV3(
      loose,
      groupPasteRequestV3(loose, copy().clipboard, { offset: { x: 0, y: 0 } }),
    ),
  ).toMatchObject({ type: 'blocked', code: 'incompatible' });
  const noPorts = createGroupEditorV3(
    { ...editor.document, capabilities: { groupPorts: false }, graph: { nodes: [], edges: [] } },
    { sessionId: 'no-ports' },
  );
  expect(
    applyGroupPasteV3(
      noPorts,
      groupPasteRequestV3(noPorts, copy().clipboard, { offset: { x: 0, y: 0 } }),
    ),
  ).toMatchObject({ type: 'blocked', code: 'incompatible' });
});
test('copy and paste reject malformed bounded inputs without invoking accessors or swallowing policy exceptions', () => {
  const editor = init(),
    request = groupPasteRequestV3(editor, copy().clipboard, { offset: { x: 20, y: 20 } });
  expect(copyGroupSelectionV3(editor, [])).toMatchObject({
    type: 'blocked',
    code: 'empty-selection',
  });
  expect(copyGroupSelectionV3(editor, ['g', 'g'])).toMatchObject({
    type: 'blocked',
    code: 'invalid-edit',
  });
  expect(copyGroupSelectionV3(editor, ['gone'])).toMatchObject({
    type: 'blocked',
    code: 'not-found',
  });
  let calls = 0;
  const malicious = Object.defineProperty({}, 'document', {
    enumerable: true,
    get() {
      calls++;
      return editor.document;
    },
  });
  // SAFETY: Deliberately violate the typed contract to qualify accessor rejection at the runtime boundary.
  expect(
    applyGroupPasteV3(editor, { ...request, clipboard: malicious as typeof request.clipboard })
      .type,
  ).toBe('blocked');
  expect(calls).toBe(0);
  expect(() =>
    applyGroupPasteV3(editor, request, {
      canEditPort: () => {
        throw new Error('policy defect');
      },
    }),
  ).toThrow('policy defect');
  const mutated = {
    ...request,
    source: {
      ...request.source,
      document: { ...request.source.document, viewport: { x: 9, y: 9, zoom: 1 } },
    },
  };
  expect(applyGroupPasteV3(editor, mutated)).toMatchObject({
    type: 'blocked',
    code: 'stale-source',
  });
});
test('nested groups, same-named scoped ports, opaque metadata and bends survive exactly one translation', () => {
  const document = captureGroupDocumentV3({
    version: 3,
    coordinateSpace: 'world',
    connectionMode: 'strict',
    capabilities: { groupPorts: true },
    graph: {
      nodes: [
        {
          id: 'outer',
          kind: 'group',
          label: 'Outer',
          position: { x: 0, y: 0 },
          size: { width: 500, height: 400 },
          ports: [{ id: 'api', kind: 'output', side: 'right', offset: 0.5 }],
          data: { reference: 'outer' },
        },
        {
          id: 'inner',
          kind: 'group',
          label: 'Inner',
          parentId: 'outer',
          extent: 'parent',
          position: { x: 100, y: 100 },
          size: { width: 200, height: 200 },
          ports: [{ id: 'api', kind: 'input', side: 'left', offset: 0.5 }],
        },
        {
          id: 'leaf',
          label: 'Leaf',
          parentId: 'inner',
          position: { x: 130, y: 130 },
          size: { width: 60, height: 40 },
          ports: [],
        },
      ],
      edges: [
        {
          id: 'nested',
          source: { node: 'outer', port: 'api' },
          target: { node: 'inner', port: 'api' },
          waypoints: [{ id: 'bend', position: { x: 70, y: 50 } }],
          data: { reference: 'inner' },
        },
      ],
    },
  });
  const editor = createGroupEditorV3(document, { sessionId: 'nested' }),
    copied = copyGroupSelectionV3(editor, ['outer', 'inner']);
  if (copied.type !== 'copied') throw new Error('Expected copy');
  const mutable = {
    ...groupPasteRequestV3(editor, copied.clipboard, { offset: { x: 20, y: 30 } }),
    offset: { x: 20, y: 30 },
  };
  const plan = planGroupPasteV3(editor, mutable);
  if (plan.type !== 'ready') throw new Error('Expected plan');
  mutable.offset.x = 900;
  const result = applyGroupPasteV3(editor, plan.request),
    nodes = result.editor.document.graph.nodes.slice(3),
    edge = result.editor.document.graph.edges[1]!;
  expect(nodes.map((n) => n.position)).toEqual([
    { x: 20, y: 30 },
    { x: 120, y: 130 },
    { x: 150, y: 160 },
  ]);
  expect(nodes[1]?.parentId).toBe(nodes[0]?.id);
  expect(nodes[2]?.parentId).toBe(nodes[1]?.id);
  expect(nodes[1]?.extent).toBe('parent');
  expect(edge.source).toEqual({ node: nodes[0]!.id, port: nodes[0]!.ports[0]!.id });
  expect(edge.target).toEqual({ node: nodes[1]!.id, port: nodes[1]!.ports[0]!.id });
  expect(edge.waypoints).toEqual([{ id: 'bend', position: { x: 90, y: 80 } }]);
  expect(nodes[0]?.data).toEqual({ reference: 'outer' });
  expect(edge.data).toEqual({ reference: 'inner' });
});

test('paste request factory rejects explicit null maps instead of silently allocating, and rejects accessor options', () => {
  const editor = init(),
    clipboard = copy().clipboard;
  expect(() =>
    // @ts-expect-error Explicit null is invalid in both typed and runtime contracts.
    groupPasteRequestV3(editor, clipboard, { offset: { x: 0, y: 0 }, identities: null }),
  ).toThrow('Invalid v3 paste mappings');
  let calls = 0;
  const options = Object.defineProperty({ offset: { x: 0, y: 0 } }, 'identities', {
    enumerable: true,
    get() {
      calls++;
      return null;
    },
  });
  expect(() => groupPasteRequestV3(editor, clipboard, options)).toThrow();
  expect(calls).toBe(0);
});
