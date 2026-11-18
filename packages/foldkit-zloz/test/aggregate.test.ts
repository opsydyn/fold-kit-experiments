import { expect, test } from 'bun:test';

import { projectAggregate } from '../src/aggregate';
import { parseGraph } from '../src/graph';
import orderWire from './fixtures/order-aggregate-v1.json';

const graph = parseGraph(JSON.stringify(orderWire));

test('the selected Order identifies each edge and preserves which event activates a policy', () => {
  expect(projectAggregate(graph, 'order')).toEqual({
    id: 'order',
    label: 'Order',
    commands: [{ edgeId: 'handles', nodeId: 'place', label: 'PlaceOrder', evidence: 'typed' }],
    events: [
      {
        edgeId: 'emits',
        nodeId: 'placed',
        label: 'OrderPlaced',
        evidence: 'typed',
        policies: [
          {
            edgeId: 'activates',
            nodeId: 'payment',
            label: 'Request payment',
            evidence: 'inferred',
          },
        ],
      },
    ],
  });
  for (const id of [null, 'missing', 'place', 'placed'])
    expect(projectAggregate(graph, id)).toBeNull();
});

test('filters incompatible links and scopes policy traversal to emitted events of this aggregate', () => {
  const [handles, emits, activates] = graph.edges;
  if (!handles || !emits || !activates) throw new Error('Incomplete Order fixture');
  const aggregate = graph.nodes.find((node) => node.id === 'order');
  const event = graph.nodes.find((node) => node.id === 'placed');
  if (!aggregate || !event) throw new Error('Missing Order participants');
  const expanded = {
    nodes: [
      ...graph.nodes,
      { ...aggregate, id: 'other', architecture: { family: 'ddd', role: 'aggregate' } as const },
      { ...event, id: 'other-event' },
    ],
    edges: [
      activates,
      {
        ...emits,
        source: { ...emits.source, node: 'other' },
        target: { ...emits.target, node: 'other-event' },
        id: 'other-emits',
      },
      { ...handles, architecture: { family: 'event-storming', role: 'triggers' } as const },
      emits,
    ],
  };
  expect(projectAggregate(expanded, 'order')?.commands).toEqual([]);
  expect(projectAggregate(expanded, 'order')?.events.map((entry) => entry.nodeId)).toEqual([
    'placed',
  ]);
  expect(projectAggregate(expanded, 'other')?.events).toEqual([
    {
      edgeId: 'other-emits',
      nodeId: 'other-event',
      label: 'OrderPlaced',
      evidence: 'typed',
      policies: [],
    },
  ]);
});
