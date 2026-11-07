import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowPortAnchorHandle, flowView } from '../src/foldkit';
import {
  createEditor,
  resolvePortAnchorSnap,
  updateEditor,
  type EditorEvent,
  type FlowGraph,
} from '../src/index';

const options = { size: { width: 200, height: 100 }, zoom: 1, distance: 0, midpointDistance: 12 };
const graph: FlowGraph = {
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

test('independent midpoint snapping uses circular screen distance for all four edges at zoom', () => {
  for (const [point, anchor, midpoint] of [
    [{ x: 0.03, y: 0.58 }, { x: 0, y: 0.5 }, 'left'],
    [{ x: 0.97, y: 0.58 }, { x: 1, y: 0.5 }, 'right'],
    [{ x: 0.54, y: 0.06 }, { x: 0.5, y: 0 }, 'top'],
    [{ x: 0.54, y: 0.94 }, { x: 0.5, y: 1 }, 'bottom'],
  ] as const) {
    expect(resolvePortAnchorSnap(point, options)).toEqual({ anchor, side: null, midpoint });
    expect(resolvePortAnchorSnap(point, { ...options, distance: 12 }).midpoint).toBe(midpoint);
  }
  const point = { x: 0.03, y: 0.58 };
  expect(resolvePortAnchorSnap(point, { ...options, midpointDistance: 0 })).toEqual({
    anchor: point,
    side: null,
  });
  expect(resolvePortAnchorSnap({ x: 0.05, y: 0.6 }, options).midpoint).toBeUndefined();
  expect(resolvePortAnchorSnap({ x: 0.06, y: 0.5 }, options).midpoint).toBe('left');
  expect(resolvePortAnchorSnap({ x: 0.061, y: 0.5 }, options).midpoint).toBeUndefined();
  expect(resolvePortAnchorSnap({ x: 0.015, y: 0.54 }, { ...options, zoom: 2 }).midpoint).toBe(
    'left',
  );
  expect(resolvePortAnchorSnap(point, { ...options, zoom: 2 }).midpoint).toBeUndefined();
  expect(resolvePortAnchorSnap({ x: -1, y: 0.5 }, options).anchor).toEqual({ x: 0, y: 0.5 });
});

test('midpoints retain radially, switch with a margin, and compose with corner and edge priority', () => {
  const retained = { ...options, hysteresis: 4, previousMidpoint: 'left' as const };
  expect(resolvePortAnchorSnap({ x: 0.075, y: 0.5 }, retained).midpoint).toBe('left');
  expect(resolvePortAnchorSnap({ x: 0.08, y: 0.5 }, retained).midpoint).toBe('left');
  expect(resolvePortAnchorSnap({ x: 0.085, y: 0.5 }, retained).midpoint).toBeUndefined();
  expect(resolvePortAnchorSnap({ x: 0.075, y: 0.5 }, options).midpoint).toBeUndefined();
  expect(
    resolvePortAnchorSnap({ x: 0.075, y: 0.5 }, { ...retained, hysteresis: 0 }).midpoint,
  ).toBeUndefined();
  expect(
    resolvePortAnchorSnap({ x: 0, y: 0.5 }, { ...retained, midpointDistance: 0 }).midpoint,
  ).toBeUndefined();
  const small = { ...retained, size: { width: 20, height: 100 } };
  expect(resolvePortAnchorSnap({ x: 0.6, y: 0.5 }, small).midpoint).toBe('left');
  expect(resolvePortAnchorSnap({ x: 0.65, y: 0.5 }, small).midpoint).toBe('right');
  expect(
    resolvePortAnchorSnap({ x: 0.5, y: 0.5 }, { ...small, hysteresis: 0, preferredSide: 'right' })
      .midpoint,
  ).toBe('right');
  expect(resolvePortAnchorSnap({ x: 0.5, y: 0.5 }, { ...small, hysteresis: 0 }).midpoint).toBe(
    'left',
  );
  expect(
    resolvePortAnchorSnap(
      { x: 0.03, y: 0.58 },
      { ...options, distance: 12, hysteresis: 4, previousSide: 'left' },
    ).midpoint,
  ).toBe('left');
  expect(resolvePortAnchorSnap({ x: 0.03, y: 0.8 }, { ...retained, distance: 12 }).side).toBe(
    'left',
  );
  // Deliberate overlap on a small frame: corners win even over a retained midpoint.
  expect(
    resolvePortAnchorSnap(
      { x: 0.1, y: 0.1 },
      { ...retained, size: { width: 20, height: 20 }, cornerDistance: 12 },
    ).corner,
  ).toBe('top-left');
});

test('midpoint previews recompute on bypass and share a protected, reversible single transaction', () => {
  const initial = createEditor(graph, {
    portAnchorMidpointSnapDistance: 12,
    portAnchorSnapHysteresis: 4,
  });
  const begun = updateEditor(initial, start);
  const snapped = move(begun, 6, 58);
  expect(snapped.graph.nodes[0]?.ports[0]).toEqual({
    id: 'p',
    kind: 'input',
    side: 'right',
    anchor: { x: 0, y: 0.5 },
  });
  expect(snapped.gesture).toMatchObject({
    snappedMidpoint: 'left',
    snappedCorner: null,
    snappedSide: null,
  });
  expect(snapped.past).toHaveLength(0);
  expect(updateEditor(snapped, { ...bypass(true), pointer: 2 })).toBe(snapped);
  const free = updateEditor(snapped, bypass(true));
  expect(free.graph.nodes[0]?.ports[0]?.anchor?.x).toBeCloseTo(0.03, 12);
  expect(free.graph.nodes[0]?.ports[0]?.anchor?.y).toBeCloseTo(0.58, 12);
  expect(free.gesture).toMatchObject({ snapBypassed: true, snappedMidpoint: null });
  expect(free.portAnchorMidpointSnapDistance).toBe(12);
  expect(updateEditor(free, bypass(false)).gesture).toMatchObject({ snappedMidpoint: 'left' });
  const retained = move(snapped, 15, 50);
  expect(retained.gesture).toMatchObject({ snappedMidpoint: 'left' });
  expect(updateEditor(updateEditor(retained, bypass(true)), bypass(false)).gesture).toMatchObject({
    snappedMidpoint: null,
  });
  const saved = updateEditor(snapped, release);
  expect(saved.past).toHaveLength(1);
  const undone = updateEditor(saved, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(saved.graph);
  expect(updateEditor(free, release).graph).toEqual(free.graph);
  expect(updateEditor(free, release).past).toHaveLength(1);
  expect(updateEditor(snapped, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  expect(updateEditor(snapped, release, { canEditPort: () => 'Managed' }).graph).toEqual(
    initial.graph,
  );
  expect(updateEditor({ ...snapped, readOnly: true }, bypass(true)).graph).toEqual(initial.graph);
  expect(updateEditor(move(snapped, 100, 50), release).past).toHaveLength(0);
});

test('midpoint preferences validate and change only while idle without editing graph or history', () => {
  const initial = createEditor(graph);
  expect(initial.portAnchorMidpointSnapDistance).toBe(0);
  for (const distance of [-1, NaN, Infinity]) {
    expect(() => createEditor(graph, { portAnchorMidpointSnapDistance: distance })).toThrow();
    expect(() =>
      resolvePortAnchorSnap({ x: 0, y: 0 }, { ...options, midpointDistance: distance }),
    ).toThrow();
    expect(updateEditor(initial, { type: 'PortAnchorMidpointSnapDistanceChanged', distance })).toBe(
      initial,
    );
  }
  const enabled = updateEditor(initial, {
    type: 'PortAnchorMidpointSnapDistanceChanged',
    distance: 12,
  });
  expect(enabled.portAnchorMidpointSnapDistance).toBe(12);
  expect(enabled.graph).toBe(initial.graph);
  expect(enabled.past).toBe(initial.past);
  const begun = updateEditor(enabled, start);
  expect(updateEditor(begun, { type: 'PortAnchorMidpointSnapDistanceChanged', distance: 0 })).toBe(
    begun,
  );
  expect(
    updateEditor(enabled, { type: 'PortAnchorMidpointSnapDistanceChanged', distance: 0 })
      .portAnchorMidpointSnapDistance,
  ).toBe(0);
});

test('nearby midpoints preserve no-motion, exact nudging and held-at-start bypass', () => {
  const near: FlowGraph = {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      ports: [{ id: 'p', kind: 'input', side: 'right', anchor: { x: 0.03, y: 0.58 } }],
    })),
  };
  const initial = createEditor(near, { portAnchorMidpointSnapDistance: 12 });
  const begun = updateEditor(initial, start);
  const still = updateEditor(begun, { type: 'PointerMoved', pointer: 1, point: { x: 0, y: 0 } });
  expect(updateEditor(still, release).graph).toEqual(initial.graph);
  expect(updateEditor(still, release).past).toHaveLength(0);
  const precise = updateEditor(initial, {
    type: 'PortAnchorNudged',
    endpoint: { node: 'n', port: 'p' },
    delta: { x: 0.01, y: 0 },
  });
  expect(precise.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0.04, y: 0.58 });
  const held = updateEditor(initial, { ...start, snapBypassed: true });
  const moved = updateEditor(held, { type: 'PointerMoved', pointer: 1, point: { x: 1, y: 1 } });
  expect(moved.gesture).toMatchObject({ snappedMidpoint: null, snapBypassed: true });
  expect(updateEditor(moved, release).past).toHaveLength(1);
});

test('native and custom handles expose midpoint feedback through the public composition helper', async () => {
  const initial = {
    ...createEditor(graph, { portAnchorMidpointSnapDistance: 12 }),
    selectedNodes: ['n'],
  };
  const preview = move(updateEditor(initial, start), 6, 58);
  for (const custom of [false, true]) {
    const result = await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model: preview }),
          view: (model, h: HtmlBuilder<EditorEvent>) => ({
            title: 'Midpoints',
            body: flowView(h, model, {
              id: 'midpoints',
              label: 'Midpoints',
              onEvent: (event) => event,
              portAnchorHandles: true,
              renderPortAnchorHandle: (context, builder) => {
                expect(context.snappedMidpoint).toBe('left');
                expect(context.snappedSide).toBeNull();
                expect(context.snappedCorner).toBeNull();
                return custom
                  ? flowPortAnchorHandle(
                      builder,
                      context,
                      [builder.Class('custom-midpoint')],
                      [`Centered ${context.snappedMidpoint}`],
                    )
                  : undefined;
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
    expect(handle?.getAttribute('data-flow-anchor-midpoint')).toBe('left');
    expect(handle?.getAttribute('data-flow-anchor-snapped')).toBeNull();
    expect(handle?.getAttribute('data-flow-anchor-corner')).toBeNull();
    expect(handle?.getAttribute('title')).toContain('Snapped to left midpoint. Hold Alt');
    expect(handle?.textContent).toBe(custom ? 'Centered left' : '⊙');
    expect(handle?.getAttribute('style')).toContain('touch-action');
  }
});
