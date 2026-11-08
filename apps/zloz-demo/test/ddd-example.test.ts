import { expect, test } from 'bun:test';

import { createEditor, parseGraph, serializeGraph, updateEditor } from '@opsydyn/foldkit-zloz';

import { createDddOrderGraph } from '../src/editor/ddd-examples';
import { Message } from '../src/editor/message';
import { init } from '../src/editor/model';
import { update } from '../src/editor/update';

test('Order model covers eight DDD roles, canonical round trips and a portless aggregate', () => {
  const graph = createDddOrderGraph();
  expect(graph.nodes.map((node) => node.architecture?.role).sort()).toEqual([
    'aggregate',
    'aggregate-root',
    'bounded-context',
    'domain-event',
    'domain-service',
    'entity',
    'repository',
    'value-object',
  ]);
  expect(createEditor(parseGraph(serializeGraph(graph))).graph).toEqual(graph);
  const aggregate = graph.nodes.find((node) => node.id === 'order-aggregate');
  expect(aggregate?.kind).toBe('group');
  expect(aggregate?.ports).toEqual([]);
  expect(
    graph.nodes.filter((node) => node.parentId === aggregate?.id).map((node) => node.id),
  ).toEqual(['order', 'line-item', 'money']);
  expect(
    graph.edges.every(
      (edge) => edge.source.node !== aggregate?.id && edge.target.node !== aggregate?.id,
    ),
  ).toBe(true);
});

test('DDD example selects package views; themes preserve history and node edits remain undoable', () => {
  const model = update(init().model, Message.SelectedExample({ example: 'ddd-orders' })).model;
  expect(model.nodeDesign).toBe('ddd');
  const dark = update(model, Message.SelectedThemePreference({ themePreference: 'dark' })).model;
  expect(dark.editor).toBe(model.editor);
  const edited = updateEditor(dark.editor, {
    type: 'NodeLabelChanged',
    id: 'order',
    label: 'Purchase order',
  });
  expect(edited.graph.nodes.find((node) => node.id === 'order')?.label).toBe('Purchase order');
  expect(updateEditor(edited, { type: 'UndoPressed' }).graph).toEqual(model.editor.graph);
});
