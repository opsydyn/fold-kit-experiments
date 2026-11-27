import { expect, test } from 'bun:test';

import {
  FlowError,
  ZlozError,
  createEditor,
  parseGraph,
  serializeGraph,
  updateEditor,
  type FlowGraph,
  type ZlozGraph,
} from '../src/index';

test('Zloz and legacy headless errors share their constructor', () => {
  expect(ZlozError).toBe(FlowError);
});

test('legacy version-one models retain architecture and undo through the Zloz contract', async () => {
  const json = await Bun.file(new URL('./fixtures/architecture-v1.json', import.meta.url)).text();
  const graph: ZlozGraph = parseGraph(json);
  const legacy: FlowGraph = graph;
  const state = createEditor(legacy);
  const edited = updateEditor(state, {
    type: 'NodeLabelChanged',
    id: 'store',
    label: 'Zloz model',
  });
  expect(edited.graph.nodes[0]?.label).toBe('Zloz model');
  expect(edited.graph.nodes[0]?.architecture).toEqual(graph.nodes[0]?.architecture);
  expect(updateEditor(edited, { type: 'UndoPressed' }).graph).toEqual(graph);
  expect(parseGraph(serializeGraph(graph))).toEqual(graph);
});
