import { expect, test } from 'bun:test';

import { BoxGeometry, type Mesh } from 'three';

import {
  createSceneGraph,
  lentGeometry,
  mesh,
  scene,
  standard,
  xrMesh,
  xrMeshGeometryId,
} from '../src/kernel/index.ts';

test('a lent geometry shows while lent, empty before and after; the scene never disposes it', () => {
  const graph = createSceneGraph();
  graph.reconcile(
    scene({
      children: [mesh({ key: 'couch', geometry: lentGeometry('couch'), material: standard() })],
    }),
  );
  const shown = () => (graph.object('couch') as Mesh).geometry;
  expect(shown().getAttribute('position')).toBeUndefined();
  const geometry = new BoxGeometry(2, 1, 1);
  let disposed = false;
  geometry.addEventListener('dispose', () => {
    disposed = true;
  });
  const withdraw = graph.store.lendGeometry('couch', geometry);
  expect(shown()).toBe(geometry);
  expect(graph.store.stats().geometries.live).toBe(0);
  withdraw();
  expect(shown()).not.toBe(geometry);
  graph.store.lendGeometry('couch', geometry);
  graph.reconcile(scene({ children: [] }));
  graph.dispose();
  expect(disposed).toBe(false);
});

test('a detected mesh’s geometry is lent under its own id', () => {
  expect(xrMesh('mesh-0')).toEqual({ _tag: 'LentGeometry', id: xrMeshGeometryId('mesh-0') });
  expect(xrMeshGeometryId('mesh-0')).toBe('xr-mesh/mesh-0');
});
