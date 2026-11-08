import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowView } from '../src/foldkit';
import {
  createEditor,
  updateEditor,
  resolvePortAnchorSnap,
  type EditorEvent,
  type FlowGraph,
} from '../src/index';

const graph: FlowGraph = {
  nodes: [
    {
      id: 'n',
      label: 'N',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      ports: [{ id: 'in', kind: 'input', side: 'right', anchor: { x: 0.5, y: 0.5 } }],
    },
  ],
  edges: [],
};
const endpoint = { node: 'n', port: 'in' };
const start: EditorEvent = {
  type: 'PortAnchorDragStarted',
  endpoint,
  pointer: 1,
  point: { x: 0, y: 0 },
};
const release: EditorEvent = { type: 'PointerReleased', pointer: 1 };

test('edge attraction uses the nearest edge in screen pixels, with an explicit disabled default', () => {
  const options = { size: { width: 200, height: 100 }, zoom: 1, distance: 12 };
  for (const [anchor, expected, side] of [
    [{ x: 0.03, y: 0.5 }, { x: 0, y: 0.5 }, 'left'],
    [{ x: 0.97, y: 0.5 }, { x: 1, y: 0.5 }, 'right'],
    [{ x: 0.5, y: 0.08 }, { x: 0.5, y: 0 }, 'top'],
    [{ x: 0.5, y: 0.92 }, { x: 0.5, y: 1 }, 'bottom'],
  ] as const)
    expect(resolvePortAnchorSnap(anchor, options)).toEqual({ anchor: expected, side });
  expect(resolvePortAnchorSnap({ x: 0.06, y: 0.5 }, options).side).toBe('left');
  expect(resolvePortAnchorSnap({ x: 0.061, y: 0.5 }, options).side).toBeNull();
  const point = { x: 0.025, y: 0.5 };
  expect(resolvePortAnchorSnap(point, { ...options, zoom: 2 }).side).toBe('left');
  expect(resolvePortAnchorSnap(point, { ...options, zoom: 4 })).toEqual({
    anchor: point,
    side: null,
  });
  expect(resolvePortAnchorSnap(point, { ...options, distance: 0 })).toEqual({
    anchor: point,
    side: null,
  });
  expect(point).toEqual({ x: 0.025, y: 0.5 });
  expect(
    resolvePortAnchorSnap({ x: 0.03, y: 0.06 }, { ...options, preferredSide: 'top' }).side,
  ).toBe('top');
  expect(resolvePortAnchorSnap({ x: -1, y: 0.5 }, { ...options, distance: 0 }).anchor).toEqual({
    x: 0,
    y: 0.5,
  });
  expect(() => resolvePortAnchorSnap(point, { ...options, zoom: 0 })).toThrow();
  expect(() =>
    resolvePortAnchorSnap(point, { ...options, size: { width: 0, height: 100 } }),
  ).toThrow();
  for (const distance of [-1, NaN, Infinity]) {
    expect(() => resolvePortAnchorSnap(point, { ...options, distance })).toThrow();
    expect(() => createEditor(graph, { portAnchorSnapDistance: distance })).toThrow();
  }
});

test('snapped drag previews retain side and identity, undo once, cancel, and recheck protection', () => {
  const state = createEditor(graph, {
    portAnchorSnapDistance: 12,
    viewport: { x: 0, y: 0, zoom: 2 },
  });
  const begun = updateEditor(state, start);
  const move: EditorEvent = { type: 'PointerMoved', pointer: 1, point: { x: -190, y: 0 } };
  const preview = updateEditor(begun, move);
  expect(preview.graph.nodes[0]?.ports[0]).toEqual({
    id: 'in',
    kind: 'input',
    side: 'right',
    anchor: { x: 0, y: 0.5 },
  });
  expect(preview.gesture).toMatchObject({ type: 'port-anchor-drag', snappedSide: 'left' });
  expect(preview.past).toHaveLength(0);
  const saved = updateEditor(preview, release);
  expect(saved.past).toHaveLength(1);
  expect(updateEditor(saved, { type: 'UndoPressed' }).graph).toEqual(state.graph);
  expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(state.graph);
  const blocked = updateEditor(preview, release, { canEditPort: () => 'Managed anchor' });
  expect(blocked.graph).toEqual(state.graph);
  expect(blocked.notice).toBe('Managed anchor');
  expect(blocked.past).toHaveLength(0);
  const freed = updateEditor(preview, { ...move, point: { x: -150, y: 0 } });
  expect(freed.graph.nodes[0]?.ports[0]?.anchor?.x).toBe(0.125);
  expect(freed.gesture).toMatchObject({ snappedSide: null });
});

test('no-motion and out-and-back gestures do not magnetize an existing nearby anchor', () => {
  const near: FlowGraph = {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      ports: [{ id: 'in', kind: 'input', side: 'right', anchor: { x: 0.03, y: 0.5 } }],
    })),
  };
  const state = createEditor(near, { portAnchorSnapDistance: 12 });
  const begun = updateEditor(state, start);
  const still = updateEditor(begun, { type: 'PointerMoved', pointer: 1, point: { x: 0, y: 0 } });
  expect(updateEditor(still, release).graph).toEqual(state.graph);
  const moved = updateEditor(begun, { type: 'PointerMoved', pointer: 1, point: { x: 1, y: 0 } });
  const back = updateEditor(moved, { type: 'PointerMoved', pointer: 1, point: { x: 0, y: 0 } });
  expect(updateEditor(back, release).past).toHaveLength(0);
  expect(back.graph).toEqual(state.graph);
  expect(createEditor(graph).portAnchorSnapDistance).toBe(0);
  expect(updateEditor(begun, { type: 'PortAnchorSnapDistanceChanged', distance: 0 })).toBe(begun);
  expect(updateEditor(state, { type: 'PortAnchorSnapDistanceChanged', distance: -1 })).toBe(state);
  const disabled = updateEditor(state, { type: 'PortAnchorSnapDistanceChanged', distance: 0 });
  expect(disabled.graph).toBe(state.graph);
  expect(disabled.past).toHaveLength(0);
  expect(disabled.portAnchorSnapDistance).toBe(0);
  const precise = updateEditor(state, {
    type: 'PortAnchorNudged',
    endpoint,
    delta: { x: 0.01, y: 0 },
  });
  expect(precise.graph.nodes[0]?.ports[0]?.anchor?.x).toBe(0.04);
});

test('renderers and native handles expose active edge feedback without adding document history', async () => {
  const state = { ...createEditor(graph, { portAnchorSnapDistance: 12 }), selectedNodes: ['n'] };
  const preview = updateEditor(updateEditor(state, start), {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: -95, y: 0 },
  });
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: preview }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Snapping',
          body: flowView(h, model, {
            id: 'snap',
            label: 'Snap',
            onEvent: (event) => event,
            portAnchorHandles: true,
            renderPortAnchorHandle: (context) => {
              expect(context.active).toBe(true);
              expect(context.snappedSide).toBe('left');
              return undefined;
            },
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  const handle = window.document.querySelector('[data-flow-anchor-port]');
  expect(handle?.getAttribute('data-flow-anchor-snapped')).toBe('left');
  expect(handle?.getAttribute('title')).toContain('Snapped to left edge');
  expect(handle?.getAttribute('style')).toContain('2px solid');
  expect(preview.past).toHaveLength(0);
});
