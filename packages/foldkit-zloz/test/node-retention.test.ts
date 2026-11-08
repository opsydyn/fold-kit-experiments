import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozPort, zlozView, type ZlozViewOptions } from '../src/foldkit';
import {
  createEditor,
  updateEditor,
  type EditorEvent,
  type EditorState,
  type ZlozNode,
} from '../src/index';

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

async function render(state: EditorState, options: Partial<ZlozViewOptions<EditorEvent>>) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Node retention',
          body: zlozView(h, model, { id: 'retain', label: 'Diagram', onEvent, ...options }),
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
  const nodeViewCache: NonNullable<ZlozViewOptions<EditorEvent>['nodeViewCache']> = (
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

function bodyRecorder() {
  const calls: Array<{ node: ZlozNode; args: readonly unknown[] }> = [];
  const nodeBodyCache = <Args extends readonly unknown[]>(
    node: ZlozNode,
    view: (...args: Args) => Html,
    args: Args,
  ): Html => {
    calls.push({ node, args });
    return view(...args);
  };
  return { calls, nodeBodyCache };
}

test('body retention ignores changing port decisions and source while native ports remain fresh and direct frame children', async () => {
  const { calls, nodeBodyCache } = bodyRecorder();
  let reason: string | null = 'Managed input.';
  const policy = ({ node, port }: { node: string; port: string }) =>
    node === 'b' && port === 'in' ? reason : null;
  const first = await render(arm('a'), { nodeBodyCache, canConnectPort: policy });
  expect(calls).toHaveLength(2);
  expect(
    first.querySelector('[data-flow-owner="b"][data-flow-port="in"]')?.getAttribute('title'),
  ).toBe('Managed input.');
  reason = null;
  const second = await render(arm('b'), { nodeBodyCache, canConnectPort: policy });
  expect(calls).toHaveLength(4);
  expect(calls[0]?.args.every((arg, i) => arg === calls[2]?.args[i])).toBe(true);
  expect(calls[1]?.args.every((arg, i) => arg === calls[3]?.args[i])).toBe(true);
  expect(pressed(second)).toEqual(['b/out']);
  expect(second.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(0);
  expect(
    second.querySelector('[data-flow-owner="b"][data-flow-port="in"]')?.hasAttribute('title'),
  ).toBe(false);
  expect(second.querySelectorAll('[data-flow-node-body] [data-flow-port]')).toHaveLength(0);
  const body = second.querySelector('[data-flow-node-body="b"]')!;
  expect(body.parentElement).toBe(
    second.querySelector('[data-flow-owner="b"][data-flow-port="in"]')?.parentElement ?? null,
  );
});

test('body retention preserves native control order and invalidates read-only and selected body controls', async () => {
  const { calls, nodeBodyCache } = bodyRecorder();
  const plain = await render(initial, {});
  const cached = await render(initial, { nodeBodyCache });
  const controls = (document: Awaited<ReturnType<typeof render>>) =>
    [...document.querySelectorAll('button,input,select,[tabindex]')].map(
      (element) => element.getAttribute('aria-label') ?? element.textContent,
    );
  expect(controls(cached)).toEqual(controls(plain));
  const locked = await render({ ...initial, readOnly: true }, { nodeBodyCache });
  expect(calls[0]?.args).not.toEqual(calls[2]?.args);
  expect(locked.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(4);
  const selected = await render({ ...initial, selectedNodes: ['b'] }, { nodeBodyCache });
  expect(calls[0]?.args).not.toEqual(calls[4]?.args);
  expect(selected.querySelector('[data-flow-handle="b"]')?.getAttribute('aria-pressed')).toBe(
    'true',
  );
});

test('custom port renderers run live beside retained bodies with current policy and active feedback', async () => {
  const { calls, nodeBodyCache } = bodyRecorder();
  const seen: string[] = [];
  const renderPort: NonNullable<ZlozViewOptions<EditorEvent>['renderPort']> = (context, h) => {
    seen.push(`${context.node.id}/${context.port.id}:${context.active}:${context.disabledReason}`);
    return zlozPort(h, context, context.port, [], [context.disabledReason ?? 'Open']);
  };
  const first = await render(arm('a'), {
    nodeBodyCache,
    renderPort,
    canConnectPort: () => 'Locked.',
  });
  expect(first.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(4);
  const second = await render(arm('b'), { nodeBodyCache, renderPort, canConnectPort: () => null });
  expect(calls).toHaveLength(4);
  expect(calls[0]?.args.every((arg, i) => arg === calls[2]?.args[i])).toBe(true);
  expect(seen).toContain('a/out:true:Locked.');
  expect(seen).toContain('b/out:true:null');
  expect(pressed(second)).toEqual(['b/out']);
  expect(second.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(0);
});

test('body retention keeps custom shells, body policies and editing gestures on the live path', async () => {
  const { calls, nodeBodyCache } = bodyRecorder();
  const selected = await render(initial, {
    nodeBodyCache,
    canSelectNode: () => 'Selection locked.',
  });
  expect(selected.querySelector('[data-flow-handle]')?.hasAttribute('disabled')).toBe(true);
  await render(initial, { nodeBodyCache, renderNodeShell: (_, h) => h.div([], ['Custom shell']) });
  const dragging = updateEditor(initial, {
    type: 'ConnectionDragStarted',
    endpoint: { node: 'a', port: 'out' },
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  await render(dragging, { nodeBodyCache });
  expect(calls).toHaveLength(0);
});

test('body retention follows culled membership and pins pending sources without changing remaining body keys', async () => {
  const { calls, nodeBodyCache } = bodyRecorder();
  const state = {
    ...initial,
    surface: { width: 180, height: 120 },
    viewport: { x: -190, y: 0, zoom: 1 },
  };
  const options = { nodeBodyCache, canConnectPort: () => null, viewportCulling: { overscan: 0 } };
  const first = await render(state, options);
  expect(first.querySelectorAll('[data-flow-node-body]')).toHaveLength(1);
  const pinned = await render({ ...state, connection: { node: 'a', port: 'out' } }, options);
  expect(pinned.querySelectorAll('[data-flow-node-body]')).toHaveLength(2);
  expect(pressed(pinned)).toEqual(['a/out']);
  expect(calls[0]?.args.every((arg, i) => arg === calls[2]?.args[i])).toBe(true);
  const cancelled = await render(state, options);
  expect(cancelled.querySelectorAll('[data-flow-owner="a"]')).toHaveLength(0);
});

test('whole-layer and live-port modes share the same body slots and keys', async () => {
  const { nodeViewCache } = recorder();
  const { calls, nodeBodyCache } = bodyRecorder();
  await render(arm('a'), { nodeViewCache, nodeBodyCache });
  const locked = await render(arm('b'), {
    nodeViewCache,
    nodeBodyCache,
    canConnectPort: () => 'Locked.',
  });
  expect(calls).toHaveLength(4);
  expect(calls[0]?.args.every((arg, i) => arg === calls[2]?.args[i])).toBe(true);
  expect(locked.querySelectorAll('[data-flow-port]:disabled')).toHaveLength(4);
  await render(initial, { nodeViewCache, nodeBodyCache });
  expect(calls).toHaveLength(6);
  expect(calls[0]?.args.every((arg, i) => arg === calls[4]?.args[i])).toBe(true);
});
