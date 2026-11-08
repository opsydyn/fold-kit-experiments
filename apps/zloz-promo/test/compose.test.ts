import { expect, test } from 'bun:test';

import { serializeGraph, type EditorEvent } from '@opsydyn/foldkit-flow';

import { init, update, observe, type Model } from '../src/examples/compose/state';

const send = (model: Model, event: EditorEvent): Model => update(model, observe(event)).model;

test('selection is transient; connection creation commits once and Undo/Redo preserve endpoint identity', () => {
  const original = init().model;
  const before = serializeGraph(original.editor.graph);
  const selected = send(original, { type: 'NodeSelected', id: 'review', additive: false });
  expect(selected.editor.selectedNodes).toEqual(['review']);
  expect(selected.editor.graph).toBe(original.editor.graph);
  expect(selected.editor.past).toHaveLength(0);
  const pending = send(selected, {
    type: 'PortActivated',
    endpoint: { node: 'review', port: 'out' },
  });
  expect(pending.editor.connection).toEqual({ node: 'review', port: 'out' });
  expect(pending.editor.past).toHaveLength(0);
  const connected = send(pending, {
    type: 'PortActivated',
    endpoint: { node: 'publish', port: 'in' },
  });
  expect(connected.editor.graph.edges).toHaveLength(2);
  expect(connected.editor.graph.edges[1]).toMatchObject({
    source: { node: 'review', port: 'out' },
    target: { node: 'publish', port: 'in' },
  });
  expect(connected.editor.past).toHaveLength(1);
  expect(connected.editor.connection).toBeNull();
  const undone = send(connected, { type: 'UndoPressed' });
  expect(serializeGraph(undone.editor.graph)).toBe(before);
  expect(undone.editor.past).toHaveLength(0);
  expect(undone.editor.future).toHaveLength(1);
  const redone = send(undone, { type: 'RedoPressed' });
  expect(redone.editor.graph).toEqual(connected.editor.graph);
  expect(serializeGraph(original.editor.graph)).toBe(before);
});

test('duplicate connections and cancellation do not add a history entry', () => {
  const original = init().model;
  const pending = send(original, {
    type: 'PortActivated',
    endpoint: { node: 'draft', port: 'out' },
  });
  const rejected = send(pending, {
    type: 'PortActivated',
    endpoint: { node: 'review', port: 'in' },
  });
  expect(rejected.editor.graph).toBe(original.editor.graph);
  expect(rejected.editor.past).toHaveLength(0);
  expect(rejected.editor.notice).toMatch(/already|duplicate/i);
  expect(rejected.editor.connection).toBeNull();
  const cancelled = send(pending, { type: 'GestureCancelled' });
  expect(cancelled.editor.connection).toBeNull();
  expect(cancelled.editor.graph).toBe(original.editor.graph);
  expect(cancelled.editor.past).toHaveLength(0);
});

test('initial measurement fits through the package without committing graph history or refitting later', () => {
  const original = init().model;
  const measured = send(original, { type: 'SurfaceMeasured', size: { width: 340, height: 360 } });
  expect(measured.editor.viewport.zoom).toBeLessThan(1);
  expect(measured.editor.graph).toBe(original.editor.graph);
  expect(measured.editor.past).toHaveLength(0);
  const panned = send(measured, { type: 'ViewportNudged', delta: { x: 20, y: 0 } });
  const resized = send(panned, { type: 'SurfaceMeasured', size: { width: 700, height: 360 } });
  expect(resized.editor.viewport).toEqual(panned.editor.viewport);
  expect(resized.editor.past).toHaveLength(0);
});
