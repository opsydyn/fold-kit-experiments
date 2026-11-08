import { expect, test } from 'bun:test';

import {
  flowView,
  zlozView,
  createFlowNodeBodyCache,
  createZlozNodeBodyCache,
} from '../src/foldkit';
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

test('Zloz APIs and deprecated aliases share constructors and view/cache implementations', () => {
  expect(ZlozError).toBe(FlowError);
  expect(zlozView).toBe(flowView);
  expect(createZlozNodeBodyCache).toBe(createFlowNodeBodyCache);
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
