import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEditor,
  startLabelMeasurement,
  updateLabelMeasurements,
  resolveLabelMeasurements,
  type ZlozLabelMeasurementResult,
  type ZlozGraph,
} from '../src/index';
const graph: ZlozGraph = {
  nodes: [
    {
      id: 'a',
      label: 'A',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'p', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'b',
      label: 'B',
      position: { x: 400, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'p', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [
    {
      id: 'ab',
      source: { node: 'a', port: 'p' },
      target: { node: 'b', port: 'p' },
      label: 'Label',
    },
  ],
};
test('measurement publishes only complete matching positive world bounds, detached from observations', () => {
  const editor = createEditor(graph),
    state = startLabelMeasurement(editor, 'one', 'renderer:1');
  const labels = [{ id: 'ab', size: { width: 133.75, height: 32.5 } }];
  const result: ZlozLabelMeasurementResult = {
    type: 'measured',
    requestId: 'one',
    revision: 0,
    renderKey: 'renderer:1',
    labels,
  };
  const next = updateLabelMeasurements(editor, state, 'renderer:1', result);
  expect(next.type).toBe('ready');
  assert(labels[0]);
  labels[0].size.width = 1;
  expect(resolveLabelMeasurements(editor, next, 'renderer:1')).toEqual({
    type: 'ready',
    edgeLabels: [{ id: 'ab', size: { width: 133.75, height: 32.5 } }],
  });
  for (const bounds of [
    [],
    [{ id: 'missing', size: { width: 10, height: 10 } }],
    [{ id: 'ab', size: { width: NaN, height: 10 } }],
    [{ id: 'ab', size: { width: 10, height: 0 } }],
    [labels[0], labels[0]],
  ]) {
    expect(
      updateLabelMeasurements(editor, state, 'renderer:1', { ...result, labels: bounds }).type,
    ).toBe('failed');
  }
  expect(editor.past).toHaveLength(0);
  expect(editor.graph).toEqual(graph);
});
test('cancelled, replaced, stale revision, same-revision source change and renderer changes cannot publish or be reused', () => {
  const editor = createEditor(graph),
    state = startLabelMeasurement(editor, 'one', 'renderer:1');
  const result: ZlozLabelMeasurementResult = {
    type: 'measured',
    requestId: 'one',
    revision: 0,
    renderKey: 'renderer:1',
    labels: [{ id: 'ab', size: { width: 100, height: 30 } }],
  };
  const ready = updateLabelMeasurements(editor, state, 'renderer:1', result);
  for (const changed of [
    { ...editor, revision: 1 },
    { ...editor, graph: { ...graph, edges: graph.edges.map((e) => ({ ...e, label: 'Changed' })) } },
  ]) {
    expect(updateLabelMeasurements(changed, state, 'renderer:1', result)).toBe(state);
    expect(resolveLabelMeasurements(changed, ready, 'renderer:1').type).toBe('unavailable');
  }
  expect(updateLabelMeasurements(editor, state, 'renderer:2', result)).toBe(state);
  expect(resolveLabelMeasurements(editor, ready, 'renderer:2').type).toBe('unavailable');
  const replaced = startLabelMeasurement(editor, 'two', 'renderer:1');
  expect(updateLabelMeasurements(editor, replaced, 'renderer:1', result)).toBe(replaced);
  const idle = { type: 'idle' } as const;
  expect(updateLabelMeasurements(editor, idle, 'renderer:1', result)).toBe(idle);
  expect(updateLabelMeasurements(editor, state, 'renderer:1', { ...result, revision: 9 })).toBe(
    state,
  );
  expect(
    updateLabelMeasurements(editor, state, 'renderer:1', { ...result, renderKey: 'old' }),
  ).toBe(state);
  expect(
    updateLabelMeasurements(editor, state, 'renderer:1', {
      type: 'failed',
      requestId: 'one',
      revision: 0,
      renderKey: 'renderer:1',
      reason: 'Timed out',
    }),
  ).toMatchObject({ type: 'failed', reason: 'Timed out' });
  expect(() => startLabelMeasurement(editor, '', 'renderer:1')).toThrow();
  expect(() => startLabelMeasurement(editor, 'new', 'renderer:1', ['ab', 'ab'])).toThrow();
});
