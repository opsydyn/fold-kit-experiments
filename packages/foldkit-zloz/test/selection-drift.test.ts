import { expect, test } from 'bun:test';

import { createEditor, updateEditor } from '../src/editor';
import { parseGraph } from '../src/graph';
import type { EditorState } from '../src/types';
import fixture from './fixtures/operations-v1.json';

const graph = parseGraph(JSON.stringify({ version: 1, graph: fixture.graph }));

const drag = (state: EditorState, point: { x: number; y: number }) =>
  updateEditor(state, { type: 'PointerMoved', pointer: 7, point }, { suppressClickDrift: true });
const press = (state: EditorState, id = 'a') =>
  updateEditor(state, { type: 'NodeDragStarted', id, pointer: 7, point: { x: 100, y: 100 } });
const release = (state: EditorState) =>
  updateEditor(state, { type: 'PointerReleased', pointer: 7 });

for (const zoom of [0.5, 1, 2])
  for (const snapToGrid of [false, true])
    test(`selection drift preserves off-grid geometry at zoom ${zoom}, grid ${snapToGrid}`, () => {
      const original = createEditor(graph, {
        viewport: { x: 0, y: 0, zoom },
        snapToGrid,
        snapToAlignment: true,
      });
      for (const point of [
        { x: 100, y: 100 },
        { x: 101, y: 100 },
        { x: 100, y: 103.99 },
        { x: 98, y: 97 },
      ]) {
        const preview = drag(press(original), point);
        expect(preview.graph).toEqual(original.graph);
        expect(preview.revision).toBe(original.revision);
        const settled = release(preview);
        expect(settled.selectedNodes).toEqual(['a']);
        expect(settled.graph).toEqual(original.graph);
        expect(settled.past).toEqual(original.past);
        expect(settled.future).toEqual(original.future);
        expect(settled.notice).not.toBe('Nodes moved');
        expect(settled.gesture.type).toBe('idle');
      }
    });

test.each([0.5, 1, 2])(
  'exactly four screen pixels authors an intentional drag at zoom %s',
  (zoom) => {
    const original = createEditor(graph, {
      viewport: { x: 0, y: 0, zoom },
      snapToGrid: false,
      snapToAlignment: false,
    });
    const started = updateEditor(original, {
      type: 'NodeDragStarted',
      id: 'a',
      pointer: 7,
      point: { x: 0, y: 0 },
    });
    const settled = release(drag(started, { x: 4, y: 0 }));
    expect(settled.graph.nodes.find(({ id }) => id === 'a')?.position).toEqual({
      x: 10 + 4 / zoom,
      y: 20,
    });
    expect(settled.past).toHaveLength(1);
    expect(settled.notice).toBe('Nodes moved');
  },
);

test('selection drift preserves a multi-selection and its grouped descendants', () => {
  let original = createEditor(graph);
  original = updateEditor(original, { type: 'NodeSelected', id: 'g', additive: false });
  original = updateEditor(original, { type: 'NodeSelected', id: 'a', additive: true });
  const settled = release(drag(press(original, 'g'), { x: 102, y: 101 }));
  expect(settled.selectedNodes).toEqual(original.selectedNodes);
  expect(settled.graph).toEqual(original.graph);
  expect(settled.past).toEqual([]);
});

test('returning inside the selection threshold discards the drag preview without an Undo entry', () => {
  const original = createEditor(graph, { snapToGrid: false, snapToAlignment: false });
  const moved = drag(press(original), { x: 130, y: 120 });
  expect(moved.graph).not.toEqual(original.graph);
  const settled = release(drag(moved, { x: 101, y: 102 }));
  expect(settled.graph).toEqual(original.graph);
  expect(settled.past).toEqual([]);
  expect(settled.gesture.type).toBe('idle');
});

test('a cancelled intentional drag restores geometry and read-only input never moves it', () => {
  const original = createEditor(graph, { snapToGrid: false });
  const moved = drag(press(original), { x: 125, y: 110 });
  const cancelled = updateEditor(moved, { type: 'GestureCancelled' });
  expect(cancelled.graph).toEqual(original.graph);
  expect(cancelled.past).toEqual([]);
  const readonly = createEditor(graph, { readOnly: true });
  expect(release(drag(press(readonly), { x: 125, y: 110 })).graph).toEqual(readonly.graph);
});
