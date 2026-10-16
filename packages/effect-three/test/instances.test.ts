import { expect, test } from 'bun:test';

import { InstancedMesh, Matrix4 } from 'three';

import {
  box,
  capacityFor,
  createPicker,
  createSceneGraph,
  group,
  instance,
  instances,
  mesh,
  type Instance,
  scene,
  standard,
} from '../src/kernel/index.ts';

const grid = (count: number, moved = -1): ReadonlyArray<Instance> =>
  Array.from({ length: count }, (_, index) =>
    instance({
      key: `i${index}`,
      position: [index === moved ? 50 : index % 10, Math.floor(index / 10), 0],
      color: 0x3366ff,
    }),
  );

const field = (list: ReadonlyArray<Instance>) =>
  scene({
    children: [
      group({
        key: 'world',
        position: [1, 2, 3],
        children: [
          mesh({ key: 'before', geometry: box(), material: standard() }),
          instances({
            key: 'crowd',
            geometry: box({ width: 0.5, height: 0.5, depth: 0.5 }),
            material: standard(),
            instances: list,
            interactive: true,
          }),
          mesh({ key: 'after', geometry: box(), material: standard() }),
        ],
      }),
    ],
  });

/** Wraps `setMatrixAt` to count calls; returns the running count. */
function countMatrixWrites(mesh: InstancedMesh): () => number {
  let writes = 0;
  const write = mesh.setMatrixAt.bind(mesh);
  mesh.setMatrixAt = function countedWrite(index, matrix) {
    writes++;
    return write(index, matrix);
  };
  return function written() {
    return writes;
  };
}

const hosted = (graph: ReturnType<typeof createSceneGraph>): InstancedMesh => {
  const object = graph.object('crowd');
  if (!(object instanceof InstancedMesh)) throw new Error('expected an InstancedMesh');
  return object;
};

test('changing one instance among 1,000 rewrites one slot', () => {
  const graph = createSceneGraph();
  graph.reconcile(field(grid(1000)));
  const crowd = hosted(graph);
  expect(crowd.count).toBe(1000);
  const writes = countMatrixWrites(crowd);
  graph.reconcile(field(grid(1000, 437)));
  expect(writes()).toBe(1);
  const matrix = new Matrix4();
  crowd.getMatrixAt(437, matrix);
  expect(matrix.elements[12]).toBe(50);
  graph.dispose();
});

test('growing past capacity swaps in a larger mesh in the same place, transform and order', () => {
  const graph = createSceneGraph();
  graph.reconcile(field(grid(10)));
  const small = hosted(graph);
  expect(small.instanceMatrix.count).toBe(capacityFor(10));
  let disposed = false;
  small.addEventListener('dispose', () => {
    disposed = true;
  });

  graph.reconcile(field(grid(40)));
  const large = hosted(graph);
  expect(large).not.toBe(small);
  expect(disposed).toBe(true);
  expect(large.count).toBe(40);
  expect(large.instanceMatrix.count).toBe(64);
  expect(large.parent?.children.map((child) => graph.keyOf(child))).toEqual([
    'before',
    'crowd',
    'after',
  ]);
  expect(graph.interactiveObjects()).toContain(large);
  expect(graph.interactiveObjects()).not.toContain(small);

  // Shrinking keeps the larger mesh: capacity never has to come back down.
  graph.reconcile(field(grid(5)));
  expect(hosted(graph)).toBe(large);
  expect(large.count).toBe(5);
  graph.dispose();
});

test('a hit on an instanced mesh names the instance', () => {
  const graph = createSceneGraph();
  graph.reconcile(
    scene({
      children: [
        instances({
          key: 'pair',
          geometry: box(),
          material: standard(),
          interactive: true,
          instances: [
            instance({ key: 'left', position: [-1.5, 0, 0] }),
            instance({ key: 'right', position: [1.5, 0, 0] }),
          ],
        }),
      ],
    }),
  );
  graph.resize(200, 200);
  const picker = createPicker(graph);
  expect(picker.pick(0, 0)).toBeUndefined();
  expect(picker.pick(-0.45, 0)).toMatchObject({ key: 'pair', instance: 'left' });
  expect(picker.pick(0.45, 0)).toMatchObject({ key: 'pair', instance: 'right' });
  graph.dispose();
});

test('duplicate instance keys are rejected; removal frees the instance buffers', () => {
  const graph = createSceneGraph();
  const twice = [instance({ key: 'a' }), instance({ key: 'a' })];
  expect(graph.reconcile(field(twice))).toEqual({
    _tag: 'Invalid',
    error: { _tag: 'DuplicateInstanceKey', nodeKey: 'crowd', key: 'a' },
  });
  graph.reconcile(field(grid(3)));
  const crowd = hosted(graph);
  let disposed = false;
  crowd.addEventListener('dispose', () => {
    disposed = true;
  });
  graph.reconcile(scene({}));
  expect(disposed).toBe(true);
  expect(graph.store.stats().geometries.live).toBe(0);
  graph.dispose();
});
