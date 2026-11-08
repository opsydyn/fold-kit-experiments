import { expect, test } from 'bun:test';

import {
  createEditor,
  resolvePortAnchorSnap,
  updateEditor,
  type EditorEvent,
  type ZlozGraph,
} from '../src/index';

const options = { size: { width: 200, height: 100 }, zoom: 1, distance: 12, hysteresis: 4 };
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
const endpoint = { node: 'n', port: 'p' };
const start: EditorEvent = {
  type: 'PortAnchorDragStarted',
  endpoint,
  pointer: 1,
  point: { x: 0, y: 0 },
};
const release: EditorEvent = { type: 'PointerReleased', pointer: 1 };

test('a retained edge releases beyond the margin and cannot acquire from the expanded band', () => {
  expect(
    resolvePortAnchorSnap({ x: 0.075, y: 0.5 }, { ...options, previousSide: 'left' }).side,
  ).toBe('left');
  expect(
    resolvePortAnchorSnap({ x: 0.08, y: 0.5 }, { ...options, previousSide: 'left' }).side,
  ).toBe('left');
  expect(
    resolvePortAnchorSnap({ x: 0.085, y: 0.5 }, { ...options, previousSide: 'left' }).side,
  ).toBeNull();
  expect(resolvePortAnchorSnap({ x: 0.075, y: 0.5 }, options).side).toBeNull();
  expect(
    resolvePortAnchorSnap({ x: 0.075, y: 0.5 }, { ...options, hysteresis: 0, previousSide: 'left' })
      .side,
  ).toBeNull();
  expect(
    resolvePortAnchorSnap({ x: 0.03, y: 0.5 }, { ...options, distance: 0, previousSide: 'left' })
      .side,
  ).toBeNull();
  expect(
    resolvePortAnchorSnap({ x: 0.0375, y: 0.5 }, { ...options, zoom: 2, previousSide: 'left' })
      .side,
  ).toBe('left');
  expect(
    resolvePortAnchorSnap({ x: 0.0375, y: 0.5 }, { ...options, zoom: 4, previousSide: 'left' })
      .side,
  ).toBeNull();
});

test('competing edges must win by more than the screen-pixel margin', () => {
  const point = { x: 0.065, y: 0.1 };
  expect(resolvePortAnchorSnap(point, { ...options, previousSide: 'left' }).side).toBe('left');
  expect(
    resolvePortAnchorSnap(point, { ...options, hysteresis: 0, previousSide: 'left' }).side,
  ).toBe('top');
  expect(
    resolvePortAnchorSnap({ x: 0.075, y: 0.1 }, { ...options, previousSide: 'left' }).side,
  ).toBe('top');
  expect(
    resolvePortAnchorSnap(
      { x: 14 / 256, y: 10 / 128 },
      { ...options, size: { width: 256, height: 128 }, previousSide: 'left' },
    ).side,
  ).toBe('left');
});

test('the reducer carries retention through previews and retains Undo, rollback and idle-only preferences', () => {
  const initial = createEditor(graph, { portAnchorSnapDistance: 12, portAnchorSnapHysteresis: 4 });
  const begun = updateEditor(initial, start);
  const move = (state: typeof initial, x: number, y: number) =>
    updateEditor(state, { type: 'PointerMoved', pointer: 1, point: { x: x - 100, y: y - 50 } });
  const acquired = move(begun, 6, 50);
  const retained = move(acquired, 15, 45);
  expect(retained.gesture).toMatchObject({ snappedSide: 'left' });
  expect(retained.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0, y: 0.45 });
  const saved = updateEditor(retained, release);
  expect(saved.past).toHaveLength(1);
  expect(updateEditor(saved, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
  expect(updateEditor(retained, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  expect(updateEditor(retained, release, { canEditPort: () => 'Managed' }).graph).toEqual(
    initial.graph,
  );
  const freed = move(retained, 17, 50);
  expect(freed.gesture).toMatchObject({ snappedSide: null });
  expect(move(freed, 15, 50).gesture).toMatchObject({ snappedSide: null });
  expect(createEditor(graph).portAnchorSnapHysteresis).toBe(0);
  expect(updateEditor(begun, { type: 'PortAnchorSnapHysteresisChanged', distance: 0 })).toBe(begun);
  expect(updateEditor(initial, { type: 'PortAnchorSnapHysteresisChanged', distance: NaN })).toBe(
    initial,
  );
  const disabled = updateEditor(initial, { type: 'PortAnchorSnapHysteresisChanged', distance: 0 });
  expect(disabled.portAnchorSnapHysteresis).toBe(0);
  expect(disabled.graph).toBe(initial.graph);
  expect(disabled.past).toBe(initial.past);
  for (const hysteresis of [-1, NaN, Infinity]) {
    expect(() => createEditor(graph, { portAnchorSnapHysteresis: hysteresis })).toThrow();
    expect(() => resolvePortAnchorSnap({ x: 0, y: 0 }, { ...options, hysteresis })).toThrow();
  }
});
