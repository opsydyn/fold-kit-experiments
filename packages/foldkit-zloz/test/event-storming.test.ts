/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Literal assertions cover authored node geometry. */
import { expect, test } from 'bun:test';

import {
  architectureNodePresets,
  createArchitectureNode,
  createArchitecturePattern,
  createEditor,
  insertPattern,
  updateEditor,
  parseGraph,
  serializeGraph,
  isNodeArchitecture,
  captureModelDocument,
  serializeModelDocument,
  parseModelDocument,
  type EventStormingNodeArchitecture,
} from '../src/index';

test('event-storming roles are explicit, strict and independent of C4/DDD structural roles', () => {
  const roles = ['command', 'domain-event', 'policy', 'actor'] as const;
  expect(
    architectureNodePresets
      .filter((preset) => preset.architecture.family === 'event-storming')
      .map((preset) => preset.architecture.role),
  ).toEqual([...roles]);
  for (const role of roles) {
    const architecture: EventStormingNodeArchitecture = {
      family: 'event-storming',
      role,
      description: 'Workshop note',
    };
    expect(isNodeArchitecture(architecture)).toBe(true);
    const node = createArchitectureNode({
      id: role,
      label: role,
      position: { x: 0, y: 0 },
      size: { width: 200, height: 140 },
      ports: [],
      architecture,
    });
    expect(node.appearance).toEqual({ shape: 'rectangle' });
    expect(() => createEditor({ nodes: [{ ...node, kind: 'group' }], edges: [] })).toThrow();
  }
  for (const descriptor of [
    { family: 'event-storming', role: 'entity' },
    { family: 'event-storming', role: 'command', technology: 'TS' },
    { family: 'event-storming', role: 'policy', subdomain: 'core' },
    { family: 'event-storming', role: 'actor', description: 1 },
    { family: 'ddd', role: 'command' },
  ])
    expect(isNodeArchitecture(descriptor)).toBe(false);
  // @ts-expect-error Structural DDD roles are not event-storming roles.
  const invalid: EventStormingNodeArchitecture = { family: 'event-storming', role: 'aggregate' };
  expect(isNodeArchitecture(invalid)).toBe(false);
});

test('literal version-one notes survive graph/model serialization and semantic edits undo', () => {
  const graph = parseGraph(
    '{"version":1,"graph":{"nodes":[{"id":"placed","label":"Order placed","position":{"x":20,"y":40},"size":{"width":200,"height":140},"ports":[],"architecture":{"family":"event-storming","role":"domain-event"}}],"edges":[]}}',
  );
  expect(graph.nodes[0]!.architecture).toEqual({ family: 'event-storming', role: 'domain-event' });
  expect(parseGraph(serializeGraph(graph))).toEqual(graph);
  const model = captureModelDocument({
    id: 'orders',
    name: 'Orders',
    snapshot: { graph },
    editions: [],
    origin: null,
  });
  expect(parseModelDocument(serializeModelDocument(model))).toEqual(model);
  const before = createEditor(graph);
  const edited = updateEditor(before, {
    type: 'NodeArchitectureChanged',
    id: 'placed',
    architecture: { family: 'event-storming', role: 'policy' },
  });
  expect(edited.graph.nodes[0]!.architecture?.role).toBe('policy');
  expect(updateEditor(edited, { type: 'UndoPressed' }).graph).toEqual(before.graph);
  expect(
    updateEditor(
      before,
      {
        type: 'NodeArchitectureChanged',
        id: 'placed',
        architecture: { family: 'event-storming', role: 'policy' },
      },
      { canChangeNodeArchitecture: () => 'Managed note' },
    ).graph,
  ).toBe(before.graph);
});

test('process starter has all four roles and connected intent/event/policy notes; insertion remains one change', () => {
  const pattern = createArchitecturePattern('event-storming');
  expect(pattern.nodes.map((node) => node.architecture?.role)).toEqual([
    'actor',
    'command',
    'domain-event',
    'policy',
    'command',
  ]);
  expect(pattern.nodes.map((node) => node.label)).toEqual([
    'Customer',
    'Place order',
    'Order placed',
    'When order placed, request payment',
    'Request payment',
  ]);
  expect(pattern.edges).toHaveLength(4);
  const source = createEditor({ nodes: [], edges: [] });
  const result = insertPattern(source, pattern);
  expect(result.type).toBe('inserted');
  expect(result.editor.past).toEqual([source.graph]);
  expect(updateEditor(result.editor, { type: 'UndoPressed' }).graph).toEqual(source.graph);
});
