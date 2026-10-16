import { expect, test } from 'bun:test';

import { GridHelper, type Object3D } from 'three';

import { createSceneGraph, grid, scene } from '../src/kernel/index.ts';

const linesOf = (graph: ReturnType<typeof createSceneGraph>): GridHelper | undefined =>
  graph.object('floor')?.children.find((child: Object3D) => child instanceof GridHelper);

test('a grid draws three.js GridHelper lines, rebuilt only when their shape changes', () => {
  const graph = createSceneGraph();
  graph.reconcile(scene({ children: [grid({ key: 'floor' })] }));
  const lines = linesOf(graph);
  const reference = new GridHelper();
  // Same lines and colours as three's defaults: 10 across, 10 divisions.
  expect(lines?.geometry.getAttribute('position').array).toEqual(
    reference.geometry.getAttribute('position').array,
  );
  expect(lines?.geometry.getAttribute('color').array).toEqual(
    reference.geometry.getAttribute('color').array,
  );
  reference.dispose();

  // Moving keeps the lines; a new size rebuilds them and frees the old.
  graph.reconcile(scene({ children: [grid({ key: 'floor', position: [0, -1, 0] })] }));
  expect(linesOf(graph)).toBe(lines);
  expect(graph.object('floor')?.position.y).toBe(-1);
  let freed = 0;
  lines?.geometry.addEventListener('dispose', () => freed++);
  graph.reconcile(scene({ children: [grid({ key: 'floor', position: [0, -1, 0], size: 20 })] }));
  expect(linesOf(graph)).not.toBe(lines);
  expect(freed).toBe(1);

  const current = linesOf(graph);
  let removed = 0;
  current?.geometry.addEventListener('dispose', () => removed++);
  graph.reconcile(scene({}));
  expect(removed).toBe(1);
  graph.dispose();
});
