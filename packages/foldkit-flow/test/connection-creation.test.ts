import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowConnectionCreation, flowView } from '../src/foldkit';
import {
  createEditor,
  resolveConnectionCreation,
  updateEditor,
  type EditorEvent,
  type EditorPolicy,
  type FlowGraph,
} from '../src/index';

const graph: FlowGraph = {
  nodes: ['a', 'b', 'c'].map((id, i) => ({
    id,
    label: id.toUpperCase(),
    position: { x: i * 200, y: 0 },
    size: { width: 150, height: 100 },
    ports: [
      { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
    ],
  })),
  edges: [
    {
      id: 'edge:1',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      data: { preserved: true },
    },
  ],
};
const initial = () => createEditor(graph);
const arm = () =>
  updateEditor(initial(), { type: 'PortActivated', endpoint: { node: 'a', port: 'out' } });

test('source choice stages without history; target choices share duplicate, port and global validation', () => {
  const policy: EditorPolicy = {
    canConnectPort: ({ node, port }) =>
      node === 'b' && port === 'out' ? 'B output locked.' : null,
    canConnect: (edge, current) => {
      expect(edge.id).toBe('edge:2');
      expect(current.edges).toEqual(graph.edges);
      return edge.target.node === 'a' ? 'No self connection.' : null;
    },
  };
  const before = initial();
  const first = resolveConnectionCreation(before, policy);
  expect(first.source.entries.find(({ endpoint }) => endpoint.node === 'b')?.reason).toBe(
    'B output locked.',
  );
  expect(first.target.hint).toBe('Choose an output port first.');
  const staged = updateEditor(
    before,
    first.source.entries.find(({ endpoint }) => endpoint.node === 'a')!.event,
    policy,
  );
  expect(staged.connection).toEqual({ node: 'a', port: 'out' });
  expect(staged.graph).toBe(before.graph);
  expect(staged.past).toHaveLength(0);
  const context = resolveConnectionCreation(staged, policy);
  expect(context.target.entries.map(({ reason }) => reason)).toEqual([
    'No self connection.',
    'These ports are already connected',
    null,
  ]);
  for (const choice of context.target.entries) {
    const next = updateEditor(staged, choice.event, policy);
    if (choice.reason) {
      expect(next.graph).toBe(staged.graph);
      expect(next.past).toBe(staged.past);
      expect(next.notice).toBe(choice.reason);
    } else {
      expect(next.graph.edges[1]).toEqual({
        id: 'edge:2',
        source: { node: 'a', port: 'out' },
        target: choice.endpoint,
      });
      expect(next.graph.edges[0]).toEqual(graph.edges[0]);
      expect(next.connection).toBeNull();
      expect(next.past).toHaveLength(1);
      expect(updateEditor(next, { type: 'UndoPressed' }).graph).toEqual(graph);
      expect(
        updateEditor(updateEditor(next, { type: 'UndoPressed' }), { type: 'RedoPressed' }).graph,
      ).toEqual(next.graph);
    }
  }
});

test('stale choices recheck both ports and policy; IDs are allocated from the current graph', () => {
  const staged = arm();
  const choice = resolveConnectionCreation(staged).target.entries.find(
    ({ endpoint }) => endpoint.node === 'c',
  )!;
  for (const policy of [
    { canConnectPort: () => 'New port lock.' },
    { canConnectPort: ({ port }: { port: string }) => (port === 'in' ? 'New input lock.' : null) },
    { canConnect: () => 'New graph rule.' },
  ]) {
    const refused = updateEditor(staged, choice.event, policy);
    expect(refused.graph).toBe(staged.graph);
    expect(refused.past).toBe(staged.past);
    expect(refused.connection).toBeNull();
  }
  const removed = {
    ...staged,
    graph: { ...graph, nodes: graph.nodes.filter(({ id }) => id !== 'c') },
  };
  expect(updateEditor(removed, choice.event)).toBe(removed);
  const changed = {
    ...staged,
    graph: {
      ...graph,
      edges: [
        ...graph.edges,
        { id: 'edge:2', source: { node: 'b', port: 'out' }, target: { node: 'c', port: 'in' } },
      ],
    },
  };
  expect(updateEditor(changed, choice.event).graph.edges[2]?.id).toBe('edge:3');
  const lockedSource = resolveConnectionCreation(staged, {
    canConnectPort: ({ port }) => (port === 'out' ? 'Source closed.' : null),
  });
  expect(lockedSource.target.reason).toBe('Source closed.');
  expect(lockedSource.target.entries.every(({ reason }) => reason === 'Source closed.')).toBe(true);
  expect(updateEditor({ ...staged, readOnly: true }, choice.event).graph).toBe(staged.graph);
});

test('visible scope retains a hidden current source; values survive reorder and collapse excludes alternatives', () => {
  const state = { ...arm(), visibility: { hiddenNodeIds: ['a', 'c'] } };
  const context = resolveConnectionCreation(state);
  expect(context.source.entries.map(({ endpoint }) => endpoint.node)).toEqual(['a', 'b']);
  expect(context.source.entries[0]).toMatchObject({ current: true, hidden: true });
  expect(context.target.entries.map(({ endpoint }) => endpoint.node)).toEqual(['b']);
  expect(resolveConnectionCreation(state, {}, { scope: 'all' }).target.entries).toHaveLength(3);
  expect(
    resolveConnectionCreation({ ...state, graph: { ...graph, nodes: [...graph.nodes].reverse() } })
      .source.value,
  ).toBe(context.source.value);
  const group = { ...graph.nodes[0]!, id: 'g', kind: 'group' as const, ports: [] };
  const collapsed = {
    ...initial(),
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
    resolveConnectionCreation(collapsed).source.entries.some(
      ({ endpoint }) => endpoint.node === 'c',
    ),
  ).toBe(false);
});

test('cancel, absent/empty sources, read-only and gestures have explicit non-mutating behavior', () => {
  const staged = arm();
  const context = resolveConnectionCreation(staged);
  const cancelled = updateEditor(staged, context.cancel.event);
  expect(cancelled.connection).toBeNull();
  expect(cancelled.graph).toBe(staged.graph);
  expect(cancelled.past).toBe(staged.past);
  expect(resolveConnectionCreation(cancelled).target.reason).toBeNull();
  expect(resolveConnectionCreation(cancelled).target.hint).toBe('Choose an output port first.');
  expect(resolveConnectionCreation({ ...staged, readOnly: true }).source.reason).toBe(
    'This diagram is read-only.',
  );
  const dragging = updateEditor(initial(), {
    type: 'ConnectionDragStarted',
    pointer: 1,
    point: { x: 0, y: 0 },
    endpoint: { node: 'a', port: 'out' },
  });
  expect(resolveConnectionCreation(dragging).source.reason).toBe(
    'Finish the current gesture before choosing ports.',
  );
  const empty = resolveConnectionCreation(createEditor({ nodes: [], edges: [] }));
  expect(empty.source.hint).toBe('No eligible output ports.');
  const missing = resolveConnectionCreation({
    ...initial(),
    connection: { node: 'missing', port: 'out' },
  });
  expect(missing.source.entries.find(({ current }) => current)?.reason).toBe(
    'Current output port is no longer available.',
  );
  expect(missing.target.reason).toBe('Choose a compatible output port.');
});

test('native fields reset to a focusable placeholder and display reasons independently of diagnostics', async () => {
  const results = [];
  for (const mode of ['on', 'off', 'read-only']) {
    results.push(
      await Effect.runPromise(
        renderToString(
          {
            Flags: Schema.Struct({}),
            init: () => ({ model: { ...initial(), readOnly: mode === 'read-only' } }),
            view: (model, h: HtmlBuilder<EditorEvent>) => ({
              title: 'Create',
              body: h.div(
                [],
                [
                  flowConnectionCreation(
                    h,
                    resolveConnectionCreation(model, {
                      canConnectPort: ({ node, port }) =>
                        node === 'b' && port === 'out' ? 'Managed output.' : null,
                    }),
                    (event) => event,
                    { idPrefix: 'custom-create' },
                  ),
                  flowView(h, model, {
                    id: 'create-view',
                    label: 'Diagram',
                    onEvent: (event) => event,
                    connectionCreation: mode !== 'off',
                    minimalMode: true,
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
  const select = window.document.querySelector('#custom-create-target-select')!;
  expect(select.hasAttribute('disabled')).toBe(false);
  expect(select.querySelector('option[selected]')?.getAttribute('value')).toBe('');
  expect(select.querySelectorAll('option:disabled')).toHaveLength(3);
  const source = window.document.querySelector('#custom-create-source-select')!;
  expect(
    window.document.getElementById(source.getAttribute('aria-describedby')!)?.textContent,
  ).toContain('Managed output.');
  expect(window.document.querySelectorAll('[aria-label="Create a connection"]')).toHaveLength(2);
  window.document.body.innerHTML = results[1]!.html;
  expect(window.document.querySelectorAll('[aria-label="Create a connection"]')).toHaveLength(1);
  window.document.body.innerHTML = results[2]!.html;
  expect(
    window.document.querySelector('#custom-create-source-select')?.hasAttribute('disabled'),
  ).toBe(true);
  expect(
    window.document.querySelector('#custom-create-target-select')?.hasAttribute('disabled'),
  ).toBe(true);
  expect(window.document.querySelector('#custom-create-source-reasons')?.textContent).toContain(
    'This diagram is read-only.',
  );
});
