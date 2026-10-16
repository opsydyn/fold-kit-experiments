import { expect, test } from 'bun:test';

import { Box3, type BufferGeometry, Mesh } from 'three';

import {
  createResourceStore,
  createSceneGraph,
  mesh,
  scene,
  sharedGeometry,
  standard,
  text,
} from '../src/kernel/index.ts';
import { blockFont } from './support/blockFont.ts';

const boundsOf = (geometry: BufferGeometry | undefined): Box3 => {
  geometry?.computeBoundingBox();
  return geometry?.boundingBox ?? new Box3();
};

const geometryOf = (graph: ReturnType<typeof createSceneGraph>, key: string) => {
  const object = graph.object(key);
  return object instanceof Mesh ? (object.geometry as BufferGeometry) : undefined;
};

const sign = (options: Partial<Parameters<typeof text>[0]> = {}) =>
  scene({
    children: [
      mesh({
        key: 'sign',
        geometry: text({ text: 'HI', font: 'block', size: 2, ...options }),
        material: standard(),
      }),
    ],
  });

test('text is empty until its font is lent, then built; withdrawing empties it again', () => {
  const graph = createSceneGraph();
  graph.reconcile(sign());
  expect(geometryOf(graph, 'sign')?.getAttribute('position')).toBeUndefined();

  const withdraw = graph.store.lendFont('block', blockFont());
  const bounds = boundsOf(geometryOf(graph, 'sign'));
  // H (1000 units) then I (200 wide) at 2 world units per 1000: from 0 to 2.4.
  expect(bounds.min.x).toBeCloseTo(0, 6);
  expect(bounds.max.x).toBeCloseTo(2.4, 6);
  expect(bounds.max.y).toBeCloseTo(2, 6);
  // Drei's Text3D default depth.
  expect(bounds.max.z - bounds.min.z).toBeCloseTo(0.2, 6);

  withdraw();
  expect(geometryOf(graph, 'sign')?.getAttribute('position')).toBeUndefined();
  graph.dispose();
  expect(graph.store.stats().geometries.live).toBe(0);
});

test('depth 0 draws flat text, and center puts its middle at the origin', () => {
  const graph = createSceneGraph();
  graph.store.lendFont('block', blockFont());
  graph.reconcile(sign({ depth: 0, center: true }));
  const bounds = boundsOf(geometryOf(graph, 'sign'));
  expect(bounds.max.z - bounds.min.z).toBe(0);
  expect(bounds.min.x).toBeCloseTo(-1.2, 6);
  expect(bounds.max.x).toBeCloseTo(1.2, 6);
  expect(bounds.min.y).toBeCloseTo(-1, 6);

  // New words rebuild the geometry.
  graph.reconcile(sign({ depth: 0, center: true, text: 'I' }));
  expect(boundsOf(geometryOf(graph, 'sign')).max.x).toBeCloseTo(0.2, 6);
  graph.dispose();
});

test('a bevel grows extruded text by its size and thickness', () => {
  const graph = createSceneGraph();
  graph.store.lendFont('block', blockFont());
  graph.reconcile(sign({ bevel: { thickness: 0.05, size: 0.03 } }));
  const bounds = boundsOf(geometryOf(graph, 'sign'));
  expect(bounds.max.z - bounds.min.z).toBeCloseTo(0.2 + 2 * 0.05, 6);
  expect(bounds.min.x).toBeCloseTo(-0.03, 6);
  graph.dispose();
});

test('shared text is rebuilt when its font arrives and swapped onto every user', () => {
  const store = createResourceStore();
  const graph = createSceneGraph({ store });
  graph.reconcile(
    scene({
      resources: { geometries: [{ id: 'title', geometry: text({ text: 'H', font: 'block' }) }] },
      children: ['a', 'b'].map((key) =>
        mesh({ key, geometry: sharedGeometry('title'), material: standard() }),
      ),
    }),
  );
  const before = geometryOf(graph, 'a');
  store.lendFont('block', blockFont());
  const after = geometryOf(graph, 'a');
  expect(after).not.toBe(before);
  expect(geometryOf(graph, 'b')).toBe(after);
  expect(boundsOf(after).max.x).toBeCloseTo(0.8, 6);
  graph.dispose();
  store.dispose();
  expect(store.stats().geometries.live).toBe(0);
});
