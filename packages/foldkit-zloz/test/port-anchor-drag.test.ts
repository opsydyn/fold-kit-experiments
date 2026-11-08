import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozView,
  zlozPortAnchorHandle,
  type ZlozViewOptions,
  type ZlozPortAnchorHandleContext,
} from '../src/foldkit';
import { createEditor, updateEditor, type EditorEvent, type EditorState } from '../src/index';

const initial = () =>
  createEditor(
    {
      nodes: [
        {
          id: 'a',
          label: 'A',
          position: { x: 100, y: 50 },
          size: { width: 200, height: 100 },
          ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
        },
        {
          id: 'b',
          label: 'B',
          position: { x: 400, y: 50 },
          size: { width: 100, height: 100 },
          ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
        },
      ],
      edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
    },
    { viewport: { x: 30, y: 40, zoom: 2 } },
  );
const endpoint = { node: 'a', port: 'out' };
const start: EditorEvent = {
  type: 'PortAnchorDragStarted',
  endpoint,
  pointer: 1,
  point: { x: 600, y: 200 },
};
const move: EditorEvent = { type: 'PointerMoved', pointer: 1, point: { x: 500, y: 250 } };
const release: EditorEvent = { type: 'PointerReleased', pointer: 1 };

test('anchor drag previews in normalized coordinates at zoom and commits wiring-preserving one-step history', () => {
  const state = initial();
  const started = updateEditor(state, start, { canConnectPort: () => 'Wiring closed' });
  expect(started.gesture.type).toBe('port-anchor-drag');
  const preview = updateEditor(started, move);
  expect(preview.graph.nodes[0]?.ports[0]).toEqual({
    id: 'out',
    kind: 'output',
    side: 'right',
    anchor: { x: 0.75, y: 0.75 },
  });
  expect(preview.graph.edges).toBe(state.graph.edges);
  expect(preview.past).toHaveLength(0);
  const committed = updateEditor(preview, release);
  expect(committed.past).toHaveLength(1);
  expect(committed.gesture.type).toBe('idle');
  const undone = updateEditor(committed, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(state.graph);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(committed.graph);
});

test('cancellation and live policy or read-only changes restore the authored port without history', () => {
  const state = initial();
  const started = updateEditor(state, start);
  const preview = updateEditor(started, move);
  expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(state.graph);
  for (const event of [move, release]) {
    const denied = updateEditor(preview, event, { canEditPort: () => 'Managed anchor' });
    expect(denied.graph).toEqual(state.graph);
    expect(denied.notice).toBe('Managed anchor');
    expect(denied.past).toHaveLength(0);
    expect(denied.gesture.type).toBe('idle');
    expect(updateEditor({ ...preview, readOnly: true }, event).graph).toEqual(state.graph);
  }
  const blocked = updateEditor(state, start, { canEditPort: () => 'Managed anchor' });
  expect(blocked.graph).toBe(state.graph);
  expect(blocked.gesture.type).toBe('idle');
  expect(blocked.notice).toBe('Managed anchor');
});

test('no movement and out-and-back drags preserve offset representation; bounds clamp and unrelated pointers do nothing', () => {
  const state = initial();
  const started = updateEditor(state, start);
  expect(updateEditor(started, { ...move, pointer: 2 })).toBe(started);
  expect(updateEditor(started, { ...release, pointer: 2 })).toBe(started);
  const untouched = updateEditor(started, release);
  expect(untouched.graph).toBe(state.graph);
  expect(untouched.past).toHaveLength(0);
  const clamped = updateEditor(started, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: -1000, y: 1000 },
  });
  expect(clamped.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0, y: 1 });
  const returned = updateEditor(clamped, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 600, y: 200 },
  });
  const settled = updateEditor(returned, release);
  expect(settled.graph).toEqual(state.graph);
  expect(settled.past).toHaveLength(0);
  const nudged = updateEditor(state, {
    type: 'PortAnchorNudged',
    endpoint,
    delta: { x: -0.01, y: 0.1 },
  });
  expect(nudged.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0.99, y: 0.6 });
  expect(nudged.past).toHaveLength(1);
});

test('measurement updates survive cancellation and preview leaves redo history intact', () => {
  const state = initial();
  const edited = updateEditor(state, { type: 'PortLabelChanged', endpoint, label: 'Ready' });
  const undone = updateEditor(edited, { type: 'UndoPressed' });
  const preview = updateEditor(updateEditor(undone, start), move);
  expect(preview.future).toBe(undone.future);
  const measured = updateEditor(preview, {
    type: 'NodeMeasured',
    id: 'a',
    size: { width: 200, height: 140 },
  });
  const cancelled = updateEditor(measured, { type: 'GestureCancelled' });
  expect(cancelled.graph.nodes[0]?.size.height).toBe(140);
  expect(cancelled.graph.nodes[0]?.ports[0]?.offset).toBe(0.5);
  expect(cancelled.future).toHaveLength(1);
  expect(cancelled.past).toHaveLength(0);
});

test('anchor handles opt in, select visible nodes, preserve custom styles and use edit permissions independently', async () => {
  const state = { ...initial(), selectedNodes: ['a'] };
  const render = async (
    options: Partial<ZlozViewOptions<EditorEvent>>,
    model: EditorState = state,
  ) => {
    const result = await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model }),
          view: (model, h: HtmlBuilder<EditorEvent>) => ({
            title: 'Anchors',
            body: zlozView(h, model, {
              id: 'anchors',
              label: 'Anchors',
              onEvent: (event) => event,
              ...options,
            }),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    );
    const window = new Window();
    window.document.body.innerHTML = result.html;
    return window.document;
  };
  const offsets: { x: number; y: number }[] = [];
  const collectOffset = (context: ZlozPortAnchorHandleContext) => {
    offsets.push({
      x: context.position.x - context.node.position.x - context.anchor.x * context.node.size.width,
      y: context.position.y - context.node.position.y - context.anchor.y * context.node.size.height,
    });
    return undefined;
  };
  await render({ portAnchorHandles: true, renderPortAnchorHandle: collectOffset });
  await render(
    { portAnchorHandles: true, renderPortAnchorHandle: collectOffset },
    updateEditor(state, { type: 'PortAnchorNudged', endpoint, delta: { x: -0.75, y: -0.25 } }),
  );
  expect(offsets).toEqual([
    { x: 18, y: -18 },
    { x: 18, y: -18 },
  ]);
  expect((await render({})).querySelector('[data-flow-anchor-port]')).toBeNull();
  const document = await render({
    portAnchorHandles: true,
    minimalMode: true,
    canConnectPort: () => 'Wiring closed',
  });
  const handle = document.querySelector('[data-flow-anchor-port="out"]');
  expect(document.querySelectorAll('[data-flow-anchor-port]')).toHaveLength(1);
  expect(handle?.hasAttribute('disabled')).toBe(false);
  expect(handle?.getAttribute('style')).toContain('width: 18px');
  expect(handle?.getAttribute('style')).toContain('touch-action: none');
  const locked = await render({
    portAnchorHandles: true,
    canEditPort: () => 'Managed anchor',
    renderPortAnchorHandle: (context, h) =>
      zlozPortAnchorHandle(
        h,
        context,
        [h.Class('custom-anchor'), h.Style({ width: '32px' })],
        ['Move'],
      ),
  });
  const custom = locked.querySelector('.custom-anchor');
  expect(custom?.getAttribute('title')).toBe('Managed anchor');
  expect(custom?.hasAttribute('disabled')).toBe(true);
  expect(custom?.getAttribute('style')).toContain('width: 32px');
  expect(custom?.getAttribute('aria-label')).toBe('Position A: out');
  expect(
    (await render({ portAnchorHandles: true, renderPortAnchorHandle: () => null })).querySelector(
      '[data-flow-anchor-port]',
    ),
  ).toBeNull();
});
