import { expect, test } from 'bun:test';

import { createOperationDocument, type ZlozNode } from '@opsydyn/foldkit-zloz';

import { prepare, type Method } from '../src/editor/selection-layout';

const node = (id: string, x: number, y: number, width: number, height: number): ZlozNode => ({
  id,
  label: id,
  position: { x, y },
  size: { width, height },
  ports: [],
});
const nodes = [
  node('first', 10, 30, 40, 30),
  node('middle', 90, 70, 60, 50),
  node('last', 220, 190, 80, 70),
];
const selection = ['last', 'first', 'middle'];
const preview = (method: Method, selected = selection, graphNodes: readonly ZlozNode[] = nodes) =>
  prepare(
    createOperationDocument({ nodes: graphNodes, edges: [] }),
    selected,
    'review',
    'RIGHT',
    method,
  );

test.each([
  [
    'align-left',
    [
      { x: 10, y: 30 },
      { x: 10, y: 70 },
      { x: 10, y: 190 },
    ],
  ],
  [
    'align-top',
    [
      { x: 10, y: 30 },
      { x: 90, y: 30 },
      { x: 220, y: 30 },
    ],
  ],
  [
    'distribute-horizontal',
    [
      { x: 10, y: 30 },
      { x: 105, y: 70 },
      { x: 220, y: 190 },
    ],
  ],
  [
    'distribute-vertical',
    [
      { x: 10, y: 30 },
      { x: 90, y: 100 },
      { x: 220, y: 190 },
    ],
  ],
] as const)('%s uses node edges and preserves the other axis', async (method, positions) => {
  expect((await preview(method)).moves).toEqual([
    { id: 'first', expected: 0, position: positions[0] },
    { id: 'middle', expected: 0, position: positions[1] },
    { id: 'last', expected: 0, position: positions[2] },
  ]);
});

test('distribution declines a short or overcrowded selection', async () => {
  await expect(preview('distribute-horizontal', ['first', 'last'])).rejects.toThrow(
    'three sibling',
  );
  const crowded = [
    node('first', 0, 0, 40, 30),
    node('middle', 20, 50, 60, 50),
    node('last', 60, 110, 80, 70),
  ];
  await expect(preview('distribute-horizontal', selection, crowded)).rejects.toThrow('more room');
});

test('a no-op alignment does not offer a proposal', async () => {
  const aligned = nodes.map((item) => ({ ...item, position: { ...item.position, y: 30 } }));
  await expect(preview('align-top', selection, aligned)).rejects.toThrow('already arranged');
});

test('alignment respects a child’s parent extent when a sibling overflows', async () => {
  const nested: readonly ZlozNode[] = [
    { ...node('group', 0, 0, 300, 300), kind: 'group' },
    { ...node('inside', 20, 30, 40, 30), parentId: 'group', extent: 'parent' },
    { ...node('overflow', -20, 70, 60, 50), parentId: 'group' },
  ];
  await expect(preview('align-left', ['inside', 'overflow'], nested)).rejects.toThrow(
    'containing group',
  );
});
