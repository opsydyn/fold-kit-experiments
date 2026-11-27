import { expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import type { GraphSurfaceOptions } from '../src/effect-ui';
import { createEditor, updateEditor, type EditorState } from '../src/index';
import { renderCanvas } from './render-effect-ui';

const initial = createEditor({
  nodes: ['a', 'b'].map((id, i) => ({
    id,
    label: id.toUpperCase(),
    position: { x: i * 200, y: 0 },
    size: { width: 150, height: 100 },
    ports: [
      { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
    ],
  })),
  edges: [],
});
const arm = (node: string) =>
  updateEditor(initial, { type: 'PortActivated', endpoint: { node, port: 'out' } });

async function render(state: EditorState, options: Partial<GraphSurfaceOptions<string>> = {}) {
  const result = await renderCanvas(state, { id: 'retain', ...options });
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}

const pressed = (document: Awaited<ReturnType<typeof render>>) =>
  [...document.querySelectorAll('[data-flow-port][aria-pressed="true"]')].map(
    (port) => `${port.getAttribute('data-flow-owner')}/${port.getAttribute('data-flow-port')}`,
  );

test('pending creation updates socket feedback as the source changes or is cancelled', async () => {
  const pending = arm('a');
  const first = await render(pending);
  await render({ ...pending, notice: 'Unrelated chooser update.' });
  expect(pressed(first)).toEqual(['a/out']);
  expect(first.querySelectorAll('[data-flow-port-kind="input"]:disabled')).toHaveLength(0);

  const changed = arm('b');
  const second = await render(changed);
  expect(pressed(second)).toEqual(['b/out']);
  const cancelled = await render(updateEditor(changed, { type: 'GestureCancelled' }), {});
  expect(pressed(cancelled)).toEqual([]);
  const readOnly = await render({ ...pending, readOnly: true });
  expect(readOnly.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(4);
});

test('retained feedback follows creation, Undo and restaging without changing history semantics', async () => {
  const pending = arm('a');
  await render(pending);
  const connected = updateEditor(pending, {
    type: 'PortActivated',
    endpoint: { node: 'b', port: 'in' },
  });
  expect(connected.past).toHaveLength(1);
  expect(pressed(await render(connected))).toEqual([]);
  const undone = updateEditor(connected, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(pressed(await render(undone))).toEqual([]);
  const staged = updateEditor(undone, {
    type: 'PortActivated',
    endpoint: { node: 'b', port: 'out' },
  });
  expect(pressed(await render(staged))).toEqual(['b/out']);
});

test('pending creation reflects changing port policies and custom socket contents', async () => {
  const pending = arm('a');
  const locked = await render(pending, { policy: { canConnectPort: () => 'Port closed.' } });
  expect(locked.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(4);
  expect(locked.querySelector('[data-flow-port]')?.getAttribute('title')).toBe('Port closed.');
  const unlocked = await render(pending, { policy: { canConnectPort: () => null } });
  expect(unlocked.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(0);
  expect(pressed(unlocked)).toEqual(['a/out']);
  const custom = await render(pending, {
    renderPort: (context) => ({ content: context.active ? 'Active output' : 'Custom port' }),
  });
  expect(custom.body.textContent).toContain('Active output');
  const dragging = updateEditor(initial, {
    type: 'ConnectionDragStarted',
    endpoint: { node: 'a', port: 'out' },
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  expect((await render(dragging)).querySelector('[data-flow-connection-preview]')).not.toBeNull();
});

test('pending sources stay pinned under culling and cancellation refreshes mounted membership', async () => {
  const pending = {
    ...arm('a'),
    surface: { width: 180, height: 120 },
    viewport: { x: -190, y: 0, zoom: 1 },
  };
  const options = { viewportCulling: { overscan: 0 } };
  const pinned = await render(pending, options);
  expect(pinned.querySelectorAll('[data-flow-node]')).toHaveLength(2);
  expect(pressed(pinned)).toEqual(['a/out']);
  const cancelled = await render(updateEditor(pending, { type: 'GestureCancelled' }), options);
  expect(cancelled.querySelectorAll('[data-flow-node]')).toHaveLength(1);
  expect(cancelled.querySelector('[data-flow-node="a"]')).toBeNull();
});

test('custom shells retain title and resize structure while sockets use current authorization', async () => {
  const options: Partial<GraphSurfaceOptions<string>> = {
    resizeHandles: true,
    renderNodeShell: ({ node }, h) => ({
      title: { content: node.label },
      body: h.span.attr('data-custom-body', node.id).children(node.label),
    }),
    renderPort: ({ disabledReason }) => ({ content: disabledReason ?? 'Open' }),
  };
  const initialView = await render(arm('a'), {
    ...options,
    policy: { canConnectPort: () => 'Locked.' },
  });
  expect(initialView.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(4);
  const next = await render(arm('b'), options);
  expect(pressed(next)).toEqual(['b/out']);
  expect(next.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(0);
  expect(next.querySelector('[data-custom-body="b"]')?.parentElement).toBe(
    next.querySelector('[data-flow-owner="b"][data-flow-port="in"]')?.parentElement ?? null,
  );
  expect(next.querySelectorAll('[data-flow-resize]')).toHaveLength(2);
  const locked = await render({ ...initial, readOnly: true }, options);
  expect(locked.querySelectorAll('[data-flow-resize]')).toHaveLength(0);
  expect(locked.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(4);
});
