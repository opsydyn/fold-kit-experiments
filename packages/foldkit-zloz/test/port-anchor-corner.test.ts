import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozPortAnchorHandle, zlozView } from '../src/foldkit';
import {
  createEditor,
  resolvePortAnchorSnap,
  updateEditor,
  type EditorEvent,
  type ZlozGraph,
} from '../src/index';

const options = { size: { width: 200, height: 100 }, zoom: 1, distance: 0, cornerDistance: 12 };
const graph: ZlozGraph = {
  nodes: [
    {
      id: 'n',
      label: 'N',
      position: { x: 0, y: 0 },
      size: options.size,
      ports: [{ id: 'p', kind: 'input', side: 'right', anchor: { x: 0.5, y: 0.5 } }],
    },
  ],
  edges: [],
};
const start: EditorEvent = {
  type: 'PortAnchorDragStarted',
  endpoint: { node: 'n', port: 'p' },
  pointer: 1,
  point: { x: 0, y: 0 },
  snapBypassModifier: 'Alt',
};
const release: EditorEvent = { type: 'PointerReleased', pointer: 1 };
const move = (state: ReturnType<typeof createEditor>, x: number, y: number) =>
  updateEditor(state, { type: 'PointerMoved', pointer: 1, point: { x: x - 100, y: y - 50 } });
const bypass = (
  bypassed: boolean,
): Extract<EditorEvent, { type: 'PortAnchorSnapBypassChanged' }> => ({
  type: 'PortAnchorSnapBypassChanged',
  pointer: 1,
  bypassed,
});

test('corners are opt-in, radial in screen pixels, and take precedence over nearby edges', () => {
  for (const [point, anchor, corner] of [
    [{ x: 0.03, y: 0.08 }, { x: 0, y: 0 }, 'top-left'],
    [{ x: 0.97, y: 0.08 }, { x: 1, y: 0 }, 'top-right'],
    [{ x: 0.03, y: 0.92 }, { x: 0, y: 1 }, 'bottom-left'],
    [{ x: 0.97, y: 0.92 }, { x: 1, y: 1 }, 'bottom-right'],
  ] as const) {
    expect(resolvePortAnchorSnap(point, options)).toEqual({ anchor, side: null, corner });
    expect(resolvePortAnchorSnap(point, { ...options, distance: 12 }).corner).toBe(corner);
  }
  expect(resolvePortAnchorSnap({ x: 0.03, y: 0.08 }, { ...options, cornerDistance: 0 })).toEqual({
    anchor: { x: 0.03, y: 0.08 },
    side: null,
  });
  // Both axes are inside 12px, but the diagonal is outside the circular radius.
  expect(resolvePortAnchorSnap({ x: 0.05, y: 0.1 }, options).corner).toBeUndefined();
  expect(resolvePortAnchorSnap({ x: 0.05, y: 0.1 }, { ...options, distance: 12 }).side).toBe(
    'left',
  );
  expect(resolvePortAnchorSnap({ x: 0.06, y: 0 }, options).corner).toBe('top-left');
  expect(resolvePortAnchorSnap({ x: 0.061, y: 0 }, options).corner).toBeUndefined();
  expect(resolvePortAnchorSnap({ x: 0.015, y: 0.04 }, { ...options, zoom: 2 }).corner).toBe(
    'top-left',
  );
  expect(
    resolvePortAnchorSnap({ x: 0.03, y: 0.08 }, { ...options, zoom: 2 }).corner,
  ).toBeUndefined();
  expect(resolvePortAnchorSnap({ x: -1, y: -1 }, options).anchor).toEqual({ x: 0, y: 0 });
});

test('corner retention uses a radial release band and fresh acquisition after release', () => {
  const retained = { ...options, hysteresis: 4, previousCorner: 'top-left' as const };
  expect(resolvePortAnchorSnap({ x: 0.075, y: 0 }, retained).corner).toBe('top-left');
  expect(resolvePortAnchorSnap({ x: 0.08, y: 0 }, retained).corner).toBe('top-left');
  expect(resolvePortAnchorSnap({ x: 0.085, y: 0 }, retained).corner).toBeUndefined();
  expect(resolvePortAnchorSnap({ x: 0.075, y: 0 }, options).corner).toBeUndefined();
  expect(
    resolvePortAnchorSnap({ x: 0.075, y: 0 }, { ...retained, hysteresis: 0 }).corner,
  ).toBeUndefined();
  expect(
    resolvePortAnchorSnap({ x: 0.03, y: 0.08 }, { ...retained, cornerDistance: 0 }).corner,
  ).toBeUndefined();
  const small = { ...retained, size: { width: 20, height: 100 } };
  expect(resolvePortAnchorSnap({ x: 0.6, y: 0 }, small).corner).toBe('top-left');
  expect(resolvePortAnchorSnap({ x: 0.65, y: 0 }, small).corner).toBe('top-right');
  // An eligible corner overrides a retained edge, then releases to ordinary edge snapping.
  expect(
    resolvePortAnchorSnap(
      { x: 0.03, y: 0.08 },
      { ...options, distance: 12, hysteresis: 4, previousSide: 'left' },
    ).corner,
  ).toBe('top-left');
  expect(resolvePortAnchorSnap({ x: 0.1, y: 0.05 }, { ...retained, distance: 12 }).side).toBe(
    'top',
  );
});

test('corner previews respect bypass, routing identity, one Undo, cancellation and current policy', () => {
  const initial = createEditor(graph, {
    portAnchorCornerSnapDistance: 12,
    portAnchorSnapHysteresis: 4,
  });
  const begun = updateEditor(initial, start);
  expect(updateEditor(begun, release).past).toHaveLength(0);
  const snapped = move(begun, 6, 8);
  expect(snapped.graph.nodes[0]?.ports[0]).toEqual({
    id: 'p',
    kind: 'input',
    side: 'right',
    anchor: { x: 0, y: 0 },
  });
  expect(snapped.gesture).toMatchObject({ snappedCorner: 'top-left', snappedSide: null });
  expect(snapped.past).toHaveLength(0);
  expect(updateEditor(snapped, { ...bypass(true), pointer: 2 })).toBe(snapped);
  const free = updateEditor(snapped, bypass(true));
  expect(free.graph.nodes[0]?.ports[0]?.anchor?.x).toBeCloseTo(0.03, 12);
  expect(free.graph.nodes[0]?.ports[0]?.anchor?.y).toBeCloseTo(0.08, 12);
  expect(free.gesture).toMatchObject({
    snappedCorner: null,
    snappedSide: null,
    snapBypassed: true,
  });
  expect(free.portAnchorCornerSnapDistance).toBe(12);
  expect(updateEditor(free, bypass(false)).gesture).toMatchObject({ snappedCorner: 'top-left' });
  const retained = move(snapped, 15, 0);
  expect(retained.gesture).toMatchObject({ snappedCorner: 'top-left' });
  expect(updateEditor(updateEditor(retained, bypass(true)), bypass(false)).gesture).toMatchObject({
    snappedCorner: null,
  });
  const saved = updateEditor(snapped, release);
  expect(saved.past).toHaveLength(1);
  const undone = updateEditor(saved, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(saved.graph);
  expect(updateEditor(free, release).graph).toEqual(free.graph);
  expect(updateEditor(snapped, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  expect(updateEditor(snapped, release, { canEditPort: () => 'Managed' }).graph).toEqual(
    initial.graph,
  );
  expect(updateEditor({ ...snapped, readOnly: true }, bypass(true)).graph).toEqual(initial.graph);
  const back = move(snapped, 100, 50);
  expect(updateEditor(back, release).past).toHaveLength(0);
});

test('corner preferences validate and change only while idle without touching document history', () => {
  const initial = createEditor(graph);
  expect(initial.portAnchorCornerSnapDistance).toBe(0);
  for (const distance of [-1, NaN, Infinity]) {
    expect(() => createEditor(graph, { portAnchorCornerSnapDistance: distance })).toThrow();
    expect(() =>
      resolvePortAnchorSnap({ x: 0, y: 0 }, { ...options, cornerDistance: distance }),
    ).toThrow();
    expect(updateEditor(initial, { type: 'PortAnchorCornerSnapDistanceChanged', distance })).toBe(
      initial,
    );
  }
  const enabled = updateEditor(initial, {
    type: 'PortAnchorCornerSnapDistanceChanged',
    distance: 12,
  });
  expect(enabled.portAnchorCornerSnapDistance).toBe(12);
  expect(enabled.graph).toBe(initial.graph);
  expect(enabled.past).toBe(initial.past);
  const begun = updateEditor(enabled, start);
  expect(updateEditor(begun, { type: 'PortAnchorCornerSnapDistanceChanged', distance: 0 })).toBe(
    begun,
  );
  expect(
    updateEditor(enabled, { type: 'PortAnchorCornerSnapDistanceChanged', distance: 0 })
      .portAnchorCornerSnapDistance,
  ).toBe(0);
});

test('nearby anchors retain exact no-motion, keyboard and bypass-held placement', () => {
  const near: ZlozGraph = {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      ports: [{ id: 'p', kind: 'input', side: 'right', anchor: { x: 0.03, y: 0.08 } }],
    })),
  };
  const initial = createEditor(near, { portAnchorCornerSnapDistance: 12 });
  const begun = updateEditor(initial, start);
  const still = updateEditor(begun, { type: 'PointerMoved', pointer: 1, point: { x: 0, y: 0 } });
  expect(updateEditor(still, release).graph).toEqual(initial.graph);
  expect(updateEditor(still, release).past).toHaveLength(0);
  const precise = updateEditor(initial, {
    type: 'PortAnchorNudged',
    endpoint: { node: 'n', port: 'p' },
    delta: { x: 0.01, y: 0 },
  });
  expect(precise.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0.04, y: 0.08 });
  const held = updateEditor(initial, { ...start, snapBypassed: true });
  const moved = updateEditor(held, { type: 'PointerMoved', pointer: 1, point: { x: 1, y: 1 } });
  expect(moved.gesture).toMatchObject({ snappedCorner: null, snapBypassed: true });
  expect(moved.graph.nodes[0]?.ports[0]?.anchor?.x).toBeCloseTo(0.035, 12);
  expect(updateEditor(moved, release).past).toHaveLength(1);
});

test('custom handles receive corner feedback and compose native binding and descriptions', async () => {
  const initial = {
    ...createEditor(graph, { portAnchorCornerSnapDistance: 12 }),
    selectedNodes: ['n'],
  };
  const preview = move(updateEditor(initial, start), 6, 8);
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: preview }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Corners',
          body: zlozView(h, model, {
            id: 'corners',
            label: 'Corners',
            onEvent: (event) => event,
            portAnchorHandles: true,
            renderPortAnchorHandle: (context, builder) => {
              expect(context.snappedCorner).toBe('top-left');
              expect(context.snappedSide).toBeNull();
              return zlozPortAnchorHandle(
                builder,
                context,
                [builder.Class('custom-corner')],
                [`Pinned ${context.snappedCorner}`],
              );
            },
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  const handle = window.document.querySelector('.custom-corner');
  expect(handle?.getAttribute('data-flow-anchor-corner')).toBe('top-left');
  expect(handle?.getAttribute('data-flow-anchor-snapped')).toBeNull();
  expect(handle?.getAttribute('title')).toContain('Snapped to top-left corner. Hold Alt');
  expect(handle?.textContent).toBe('Pinned top-left');
  expect(handle?.getAttribute('style')).toContain('touch-action');
});
