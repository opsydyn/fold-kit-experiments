import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { edgeToolbarBand } from '../src/edge-toolbar-placement';
import { zlozEdgeEndpointField, zlozView } from '../src/foldkit';
import {
  createEditor,
  resolveEdgeReconnection,
  updateEditor,
  type EditorEvent,
  type EditorPolicy,
  type ZlozGraph,
} from '../src/index';

const graph: ZlozGraph = {
  nodes: ['a', 'b', 'c', 'd'].map((id, i) => ({
    id,
    label: id.toUpperCase(),
    position: { x: i * 220, y: 0 },
    size: { width: 160, height: 100 },
    ports: [
      { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
      { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
    ],
  })),
  edges: [
    {
      id: 'ab',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      label: 'Keep',
      data: { color: 'blue' },
      pathStyle: 'smooth',
    },
  ],
};
const state = () => createEditor(graph);
const targetContext = (policy: EditorPolicy = {}) =>
  resolveEdgeReconnection(state(), 'ab', 'target', policy)!;

test('expanded toolbar reserves scroll space without covering reconnect handles', () => {
  expect(edgeToolbarBand(440, [280], 15)).toEqual({ top: 6, height: 259 });
  for (const handles of [[160, 280], [10, 430], [220], [], [-50, 500]]) {
    const band = edgeToolbarBand(440, handles, 15);
    expect(band.top).toBeGreaterThanOrEqual(6);
    expect(band.top + band.height).toBeLessThanOrEqual(434);
    for (const y of handles)
      expect(band.top + band.height <= y - 15 || band.top >= y + 15).toBe(true);
  }
});

test('candidate preflight and actual commits agree, excluding the replaced edge from policy input', () => {
  const initial = createEditor({
    ...graph,
    edges: [
      ...graph.edges,
      { id: 'ac', source: graph.edges[0]!.source, target: { node: 'c', port: 'in' } },
    ],
  });
  const policy: EditorPolicy = {
    canConnect: (edge, remaining) => {
      expect(remaining.edges.some(({ id }) => id === 'ab')).toBe(false);
      return edge.target.node === 'd' ? 'D is unavailable.' : null;
    },
  };
  const context = resolveEdgeReconnection(initial, 'ab', 'target', policy)!;
  expect(context.entries.map(({ endpoint }) => endpoint.port)).toEqual(['in', 'in', 'in', 'in']);
  expect(context.entries.find(({ endpoint }) => endpoint.node === 'c')?.reason).toBe(
    'These ports are already connected',
  );
  expect(context.entries.find(({ endpoint }) => endpoint.node === 'd')?.reason).toBe(
    'D is unavailable.',
  );
  for (const choice of context.entries.filter(({ current }) => !current)) {
    const next = updateEditor(initial, choice.event, policy);
    if (choice.reason) {
      expect(next.graph).toBe(initial.graph);
      expect(next.past).toBe(initial.past);
      expect(next.notice).toBe(choice.reason);
    } else expect(next.graph.edges[0]?.target).toEqual(choice.endpoint);
  }
});

test('selectors use stable identity and retain hidden current endpoints while excluding hidden alternatives', () => {
  const initial = { ...state(), visibility: { hiddenNodeIds: ['b', 'd'] } };
  const context = resolveEdgeReconnection(initial, 'ab', 'target')!;
  expect(context.entries.map(({ endpoint }) => endpoint.node)).toEqual(['a', 'b', 'c']);
  expect(context.entries.find(({ current }) => current)).toMatchObject({
    hidden: true,
    endpoint: { node: 'b', port: 'in' },
  });
  const reordered = resolveEdgeReconnection(
    { ...initial, graph: { ...graph, nodes: [...graph.nodes].reverse() } },
    'ab',
    'target',
  )!;
  expect(reordered.value).toBe(context.value);
  expect(
    resolveEdgeReconnection(initial, 'ab', 'target', {}, { scope: 'all' })!.entries,
  ).toHaveLength(4);
  const group = { ...graph.nodes[0]!, id: 'g', kind: 'group' as const, ports: [] };
  const collapsed = {
    ...state(),
    graph: {
      ...graph,
      nodes: [
        group,
        ...graph.nodes.map((node) => (node.id === 'c' ? { ...node, parentId: 'g' } : node)),
      ],
    },
    collapsedGroups: ['g'],
  };
  expect(
    resolveEdgeReconnection(collapsed, 'ab', 'target')!.entries.some(
      ({ endpoint }) => endpoint.node === 'c',
    ),
  ).toBe(false);
});

test('commit rechecks policy, preserves identity and metadata, makes no-op history free and supports Undo/Redo', () => {
  const initial = { ...state(), selectedEdges: ['ab'] };
  const context = resolveEdgeReconnection(initial, 'ab', 'source')!;
  const choice = context.entries.find(({ endpoint }) => endpoint.node === 'c')!;
  const refused = updateEditor(initial, choice.event, { canConnectPort: () => 'Port closed.' });
  expect(refused.notice).toBe('Port closed.');
  expect(refused.past).toBe(initial.past);
  const next = updateEditor(initial, choice.event);
  expect(next.graph.edges[0]).toEqual({ ...graph.edges[0]!, source: choice.endpoint });
  expect(next.selectedEdges).toEqual(['ab']);
  expect(next.past).toHaveLength(1);
  expect(updateEditor(next, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  expect(
    updateEditor(updateEditor(next, { type: 'UndoPressed' }), { type: 'RedoPressed' }).graph,
  ).toEqual(next.graph);
  expect(updateEditor(initial, context.entries.find(({ current }) => current)!.event)).toBe(
    initial,
  );
});

test('locks, busy/read-only, absent edges and no-alternative states are explicit', () => {
  expect(targetContext({ canReconnect: () => 'Target locked.' }).reason).toBe('Target locked.');
  expect(resolveEdgeReconnection({ ...state(), readOnly: true }, 'ab', 'target')!.reason).toBe(
    'This diagram is read-only.',
  );
  const active = updateEditor(state(), {
    type: 'ConnectionDragStarted',
    endpoint: { node: 'a', port: 'out' },
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  expect(resolveEdgeReconnection(active, 'ab', 'target')!.reason).toBe(
    'Finish the current gesture before reconnecting.',
  );
  expect(resolveEdgeReconnection(state(), 'missing', 'target')).toBeNull();
  expect(targetContext({ canConnectPort: () => 'Port closed.' }).emptyReason).toBe(
    'No other eligible ports.',
  );
  expect(targetContext({ canConnectPort: () => 'Port closed.' }).reason).toBeNull();
  const onlyCurrent = { ...state(), visibility: { hiddenNodeIds: ['a', 'c', 'd'] } };
  expect(resolveEdgeReconnection(onlyCurrent, 'ab', 'target')!.entries).toHaveLength(1);
  expect(resolveEdgeReconnection(onlyCurrent, 'ab', 'target')!.emptyReason).toBe(
    'No other eligible ports.',
  );
});

test('stale candidates cannot bypass endpoint locks, missing ports or new duplicate edges', () => {
  const initial = state();
  const choice = targetContext().entries.find(({ endpoint }) => endpoint.node === 'c')!;
  for (const policy of [
    { canReconnect: () => 'New lock.' },
    { canConnect: () => 'New graph rule.' },
  ]) {
    const rejected = updateEditor(initial, choice.event, policy);
    expect(rejected.graph).toBe(initial.graph);
    expect(rejected.past).toBe(initial.past);
  }
  const removed = {
    ...initial,
    graph: { ...graph, nodes: graph.nodes.filter(({ id }) => id !== 'c') },
  };
  expect(updateEditor(removed, choice.event).notice).toBe('Choose a compatible port.');
  const duplicate = {
    ...initial,
    graph: {
      ...graph,
      edges: [...graph.edges, { ...graph.edges[0]!, id: 'ac', target: choice.endpoint }],
    },
  };
  expect(updateEditor(duplicate, choice.event).notice).toBe('These ports are already connected');
  const fixedPortLocked: EditorPolicy = {
    canConnectPort: ({ node }) => (node === 'a' ? 'Fixed output closed.' : null),
  };
  expect(
    resolveEdgeReconnection(initial, 'ab', 'target', fixedPortLocked)!.entries.find(
      ({ value }) => value === choice.value,
    )?.reason,
  ).toBeNull();
  expect(updateEditor(initial, choice.event, fixedPortLocked).graph.edges[0]?.target).toEqual(
    choice.endpoint,
  );
  expect(updateEditor({ ...initial, readOnly: true }, choice.event).graph).toBe(initial.graph);
});

test('missing current ports stay labeled and endpoint identities cannot collide on delimiters', () => {
  const initial = state();
  const missing = {
    ...initial,
    graph: {
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === 'b' ? { ...node, ports: [] } : node)),
    },
  };
  expect(resolveEdgeReconnection(missing, 'ab', 'target')!.entries[0]).toMatchObject({
    current: true,
    reason: 'Current port is no longer available.',
  });
  const tricky = createEditor({
    ...graph,
    nodes: [
      ...graph.nodes,
      {
        ...graph.nodes[0]!,
        id: 'x:y',
        ports: [{ id: 'z', kind: 'input', side: 'left', offset: 0.5 }],
      },
      {
        ...graph.nodes[0]!,
        id: 'x',
        ports: [{ id: 'y:z', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
  });
  const values = resolveEdgeReconnection(tricky, 'ab', 'target')!.entries.map(({ value }) => value);
  expect(new Set(values).size).toBe(values.length);
});

test('native controls expose visible reasons and toolbar reconnection is opt-in', async () => {
  const results = [];
  for (const toolbar of [true, false]) {
    results.push(
      await Effect.runPromise(
        renderToString(
          {
            Flags: Schema.Struct({}),
            init: () => ({ model: { ...state(), selectedEdges: ['ab'], edgeLabelDraft: null } }),
            view: (model, h: HtmlBuilder<EditorEvent>) => ({
              title: 'Endpoints',
              body: h.div(
                [],
                [
                  zlozEdgeEndpointField(
                    h,
                    targetContext({
                      canConnectPort: ({ node }) => (node === 'd' ? 'D is protected.' : null),
                    }),
                    (event) => event,
                    { idPrefix: 'custom' },
                  ),
                  zlozEdgeEndpointField(
                    h,
                    targetContext({ canConnectPort: () => 'Closed.' }),
                    (event) => event,
                    { idPrefix: 'empty' },
                  ),
                  zlozView(h, model, {
                    id: 'endpoints',
                    label: 'Diagram',
                    onEvent: (event) => event,
                    edgeToolbar: true,
                    edgeReconnection: toolbar,
                  }),
                ],
              ),
            }),
          },
          { flags: {}, isHydratable: false },
        ),
      ),
    );
  }
  const window = new Window();
  window.document.body.innerHTML = results[0]!.html;
  const select = window.document.querySelector('#custom-ab-target-select')!;
  expect(select.getAttribute('aria-label')).toBe('Target port');
  expect(window.document.querySelector('#empty-ab-target-select')?.hasAttribute('disabled')).toBe(
    false,
  );
  expect(window.document.querySelector('#empty-ab-target-reasons')?.textContent).toContain(
    'No other eligible ports.',
  );
  expect(
    window.document.getElementById(select.getAttribute('aria-describedby')!)?.textContent,
  ).toContain('D is protected.');
  expect(select.querySelector('option:disabled')?.textContent).toContain('D');
  expect(
    window.document.querySelectorAll('[aria-label="Selected edge actions"] select'),
  ).toHaveLength(3);
  window.document.body.innerHTML = results[1]!.html;
  expect(
    window.document.querySelectorAll('[aria-label="Selected edge actions"] select'),
  ).toHaveLength(1);
});
