import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowView, type FlowViewOptions } from '../src/foldkit';
import { createEditor, updateEditor, type EditorEvent, type EditorState } from '../src/index';

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
const onEvent = (event: EditorEvent) => event;
const arm = (node: string) =>
  updateEditor(initial, { type: 'PortActivated', endpoint: { node, port: 'out' } });

async function render(state: EditorState, options: Partial<FlowViewOptions<EditorEvent>>) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Node retention',
          body: flowView(h, model, { id: 'retain', label: 'Diagram', onEvent, ...options }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}

function recorder() {
  const calls: Array<readonly unknown[]> = [];
  const nodeViewCache: NonNullable<FlowViewOptions<EditorEvent>['nodeViewCache']> = (
    view,
    args,
  ) => {
    calls.push(args);
    return view(...args);
  };
  return { calls, nodeViewCache };
}

const pressed = (document: Awaited<ReturnType<typeof render>>) =>
  [...document.querySelectorAll('[data-flow-port][aria-pressed="true"]')].map(
    (port) => `${port.getAttribute('data-flow-owner')}/${port.getAttribute('data-flow-port')}`,
  );

test('pending creation retains stable layer inputs while source changes and cancellation refresh port feedback', async () => {
  const { calls, nodeViewCache } = recorder();
  const pending = arm('a');
  const first = await render(pending, { nodeViewCache });
  await render({ ...pending, notice: 'Unrelated chooser update.' }, { nodeViewCache });
  expect(calls).toHaveLength(2);
  expect(calls[0]?.every((arg, i) => arg === calls[1]?.[i])).toBe(true);
  expect(pressed(first)).toEqual(['a/out']);
  expect(first.querySelectorAll('[data-flow-port-kind="input"]:disabled')).toHaveLength(0);

  const changed = arm('b');
  const second = await render(changed, { nodeViewCache });
  expect(calls[1]).not.toEqual(calls[2]);
  expect(pressed(second)).toEqual(['b/out']);
  const cancelled = await render(updateEditor(changed, { type: 'GestureCancelled' }), {
    nodeViewCache,
  });
  expect(calls[2]).not.toEqual(calls[3]);
  expect(pressed(cancelled)).toEqual([]);
  const readOnly = await render({ ...pending, readOnly: true }, { nodeViewCache });
  expect(readOnly.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(4);
});

test('retained feedback follows creation, Undo and restaging without changing history semantics', async () => {
  const { calls, nodeViewCache } = recorder();
  const pending = arm('a');
  await render(pending, { nodeViewCache });
  const connected = updateEditor(pending, {
    type: 'PortActivated',
    endpoint: { node: 'b', port: 'in' },
  });
  expect(connected.past).toHaveLength(1);
  expect(pressed(await render(connected, { nodeViewCache }))).toEqual([]);
  expect(calls[0]).not.toEqual(calls[1]);
  const undone = updateEditor(connected, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(pressed(await render(undone, { nodeViewCache }))).toEqual([]);
  const staged = updateEditor(undone, {
    type: 'PortActivated',
    endpoint: { node: 'b', port: 'out' },
  });
  expect(pressed(await render(staged, { nodeViewCache }))).toEqual(['b/out']);
});

test('pending creation falls back for changing port policies, custom ports and editing gestures', async () => {
  const { calls, nodeViewCache } = recorder();
  const pending = arm('a');
  const locked = await render(pending, { nodeViewCache, canConnectPort: () => 'Port closed.' });
  expect(locked.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(4);
  expect(locked.querySelector('[data-flow-port]')?.getAttribute('title')).toBe('Port closed.');
  const unlocked = await render(pending, { nodeViewCache, canConnectPort: () => null });
  expect(unlocked.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(0);
  expect(pressed(unlocked)).toEqual(['a/out']);
  const custom = await render(pending, {
    nodeViewCache,
    renderPort: (context, h) => h.span([], [context.active ? 'Active output' : 'Custom port']),
  });
  expect(custom.body.textContent).toContain('Active output');
  const dragging = updateEditor(initial, {
    type: 'ConnectionDragStarted',
    endpoint: { node: 'a', port: 'out' },
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  await render(dragging, { nodeViewCache });
  expect(calls).toHaveLength(0);
  await render(pending, { nodeViewCache });
  expect(calls).toHaveLength(1);
});

test('pending sources stay pinned under culling and cancellation refreshes mounted membership', async () => {
  const { calls, nodeViewCache } = recorder();
  const pending = {
    ...arm('a'),
    surface: { width: 180, height: 120 },
    viewport: { x: -190, y: 0, zoom: 1 },
  };
  const options = { nodeViewCache, viewportCulling: { overscan: 0 } };
  const pinned = await render(pending, options);
  expect(pinned.querySelectorAll('[data-flow-node]')).toHaveLength(2);
  expect(pressed(pinned)).toEqual(['a/out']);
  const cancelled = await render(updateEditor(pending, { type: 'GestureCancelled' }), options);
  expect(cancelled.querySelectorAll('[data-flow-node]')).toHaveLength(1);
  expect(cancelled.querySelector('[data-flow-node="a"]')).toBeNull();
  expect(calls[0]).not.toEqual(calls[1]);
});
