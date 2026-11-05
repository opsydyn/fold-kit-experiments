import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowView } from '../src/foldkit';
import {
  createEditor,
  updateEditor,
  resolveConnectionPreview,
  type EditorState,
} from '../src/index';
import type { EditorEvent } from '../src/types';

const graph = {
  nodes: [
    {
      id: 'a',
      label: 'A',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 }],
    },
    {
      id: 'b',
      label: 'B',
      position: { x: 300, y: 100 },
      size: { width: 100, height: 80 },
      ports: [
        { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
        { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      ],
    },
  ],
  edges: [],
};
const start = () =>
  updateEditor(createEditor(graph, { viewport: { x: 20, y: 10, zoom: 2 } }), {
    type: 'ConnectionDragStarted',
    endpoint: { node: 'a', port: 'out' },
    point: { x: 220, y: 90 },
    pointer: 1,
  });

test('preview shares logical endpoints, snaps to valid ports and keeps free pointer coordinates in world units', () => {
  let state = updateEditor(start(), {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 420, y: 110 },
  });
  expect(resolveConnectionPreview(state)?.source).toEqual({ x: 100, y: 40 });
  expect(resolveConnectionPreview(state)?.target).toEqual({ x: 200, y: 50 });
  state = updateEditor(state, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 625, y: 295 },
    target: { node: 'b', port: 'in' },
  });
  const preview = resolveConnectionPreview(state, ({ source, target }) => ({
    path: `M${source.x},${source.y} Q200,-50 ${target.x},${target.y}`,
    labelPosition: undefined,
  }));
  expect(preview?.path).toBe('M100,40 Q200,-50 300,140');
  expect(preview?.feedback.type).toBe('valid');
  expect(preview?.pointer).toEqual({ x: 302.5, y: 142.5 });
  expect(state.graph).toEqual(graph);
  const connected = updateEditor(state, { type: 'PointerReleased', pointer: 1 });
  expect(connected.graph.edges).toHaveLength(1);
  expect(connected.past).toHaveLength(1);
  expect(resolveConnectionPreview(connected)).toBeUndefined();
  expect(updateEditor(connected, { type: 'UndoPressed' }).graph).toEqual(graph);
});

test('rejected port feedback comes from core validation, and rejected release/cancel never commits', () => {
  for (const target of [
    { node: 'b', port: 'in' },
    { node: 'b', port: 'out' },
    { node: 'b', port: 'missing' },
    { node: 'missing', port: 'in' },
  ]) {
    const state = updateEditor(
      start(),
      { type: 'PointerMoved', pointer: 1, point: { x: 600, y: 300 }, target },
      { canConnect: () => 'Blocked by host' },
    );
    const preview = resolveConnectionPreview(state);
    expect(preview?.feedback.type).toBe('invalid');
    expect(state.gesture.type === 'connection-drag' && state.gesture.target).toBeNull();
    expect(updateEditor(state, { type: 'PointerReleased', pointer: 1 }).graph).toEqual(graph);
    expect(updateEditor(state, { type: 'GestureCancelled' }).past).toHaveLength(0);
  }
});

test('source reconnection previews run from the moving output to the fixed input', () => {
  const connected = updateEditor(
    updateEditor(start(), {
      type: 'PointerMoved',
      pointer: 1,
      point: { x: 620, y: 290 },
      target: { node: 'b', port: 'in' },
    }),
    { type: 'PointerReleased', pointer: 1 },
  );
  const edge = connected.graph.edges[0];
  expect(edge).toBeDefined();
  if (!edge) return;
  const state = updateEditor(connected, {
    type: 'ReconnectionDragStarted',
    id: edge.id,
    end: 'source',
    pointer: 2,
    point: { x: 420, y: 210 },
  });
  const preview = resolveConnectionPreview(state);
  expect(preview?.source).toEqual({ x: 200, y: 100 });
  expect(preview?.target).toEqual({ x: 300, y: 140 });
  expect(preview?.edge).toEqual(edge);
  expect(resolveConnectionPreview({ ...state, readOnly: true })).toBeUndefined();
  expect(resolveConnectionPreview(createEditor(graph))).toBeUndefined();
});

test('duplicates, rejection reasons and leaving a port keep preview feedback and commit validation in agreement', () => {
  const ready = updateEditor(
    updateEditor(start(), {
      type: 'PointerMoved',
      pointer: 1,
      point: { x: 620, y: 290 },
      target: { node: 'b', port: 'in' },
    }),
    { type: 'PointerReleased', pointer: 1 },
  );
  let state = updateEditor(ready, {
    type: 'ConnectionDragStarted',
    endpoint: { node: 'a', port: 'out' },
    pointer: 2,
    point: { x: 220, y: 90 },
  });
  state = updateEditor(state, {
    type: 'PointerMoved',
    pointer: 2,
    point: { x: 620, y: 290 },
    target: { node: 'b', port: 'in' },
  });
  expect(resolveConnectionPreview(state)?.feedback).toEqual({
    type: 'invalid',
    endpoint: { node: 'b', port: 'in' },
    reason: 'These ports are already connected',
  });
  const moved = updateEditor(state, {
    type: 'PointerMoved',
    pointer: 2,
    point: { x: 450, y: 210 },
  });
  expect(resolveConnectionPreview(moved)?.feedback).toEqual({ type: 'free' });
  expect(updateEditor(moved, { type: 'PointerReleased', pointer: 2 }).graph).toEqual(ready.graph);
  expect(updateEditor(state, { type: 'PointerReleased', pointer: 2 }).past).toHaveLength(1);
});

test('reconnection retains authored path style and projects a fixed hidden endpoint to its collapsed group', () => {
  const connected = {
    ...graph,
    edges: [
      {
        id: 'ab',
        source: { node: 'a', port: 'out' },
        target: { node: 'b', port: 'in' },
        pathStyle: 'smooth' as const,
        label: 'Kept',
        data: { important: true },
      },
    ],
  };
  const initial = createEditor({
    ...connected,
    nodes: [
      {
        id: 'g',
        kind: 'group',
        label: 'Group',
        position: { x: 280, y: 80 },
        size: { width: 180, height: 140 },
        ports: [],
      },
      ...connected.nodes.map((node) => (node.id === 'b' ? { ...node, parentId: 'g' } : node)),
    ],
  });
  const collapsed = updateEditor(initial, { type: 'GroupCollapseToggled', id: 'g' });
  const dragging = updateEditor(collapsed, {
    type: 'ReconnectionDragStarted',
    id: 'ab',
    end: 'source',
    pointer: 3,
    point: { x: 200, y: 100 },
  });
  const preview = resolveConnectionPreview(dragging);
  expect(preview?.target.x).toBe(280);
  expect(preview?.targetGroup?.id).toBe('g');
  expect(preview?.path).toContain('C');
  expect(preview?.edge?.data).toEqual({ important: true });
  expect(updateEditor(dragging, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  expect(() =>
    resolveConnectionPreview(dragging, () => ({ path: '', labelPosition: undefined })),
  ).toThrow();
});

async function renderPreview(state: EditorState, hidden = false) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Preview',
          body: flowView(h, model, {
            id: 'preview',
            label: 'Connections',
            onEvent: (event) => event,
            minimalMode: true,
            connectionGeometry: ({ source, target }) => ({
              path: `M${source.x},${source.y} Q200,-50 ${target.x},${target.y}`,
              labelPosition: undefined,
            }),
            renderConnection: (context, builder) =>
              builder.g(
                [],
                hidden
                  ? []
                  : [
                      builder.path(
                        [
                          builder.D(context.path),
                          builder.Stroke(context.stroke),
                          builder.DataAttribute('custom-preview-state', context.feedback.type),
                        ],
                        [],
                      ),
                    ],
              ),
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}

test('preview geometry and SVG slots use the host builder, remain decorative, and can omit the visual without disabling a drop', async () => {
  const ready = updateEditor(start(), {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 625, y: 295 },
    target: { node: 'b', port: 'in' },
  });
  const document = await renderPreview(ready);
  const preview = document.querySelector('[data-flow-connection-preview]');
  expect(preview?.getAttribute('data-flow-connection-state')).toBe('valid');
  expect(preview?.getAttribute('style')).toContain('pointer-events: none');
  expect(preview?.getAttribute('aria-hidden')).toBe('true');
  expect(preview?.querySelector('path')?.getAttribute('d')).toBe('M100,40 Q200,-50 300,140');
  expect(
    (await renderPreview(ready, true)).querySelector('[data-flow-connection-preview] path'),
  ).toBeNull();
  expect(updateEditor(ready, { type: 'PointerReleased', pointer: 1 }).graph.edges).toHaveLength(1);
  expect(
    (await renderPreview({ ...ready, readOnly: true })).querySelector(
      '[data-flow-connection-preview]',
    ),
  ).toBeNull();
  const rejected = updateEditor(
    start(),
    {
      type: 'PointerMoved',
      pointer: 1,
      point: { x: 620, y: 290 },
      target: { node: 'b', port: 'in' },
    },
    { canConnect: () => 'Not allowed' },
  );
  expect(
    (await renderPreview(rejected))
      .querySelector('[data-custom-preview-state]')
      ?.getAttribute('stroke'),
  ).toBe('var(--flow-invalid-target, #dc2626)');
});
