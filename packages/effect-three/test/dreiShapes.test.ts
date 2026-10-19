import { expect, test } from 'bun:test';

import { Mesh } from 'three';

import {
  backdrop,
  basic,
  createSceneGraph,
  type GeometryRef,
  mesh,
  roundedBox,
  scene,
} from '../src/index.ts';

const shown = (geometry: GeometryRef) => {
  const graph = createSceneGraph();
  graph.reconcile(scene({ children: [mesh({ key: 'shape', geometry, material: basic() })] }));
  const object = graph.object('shape');
  if (!(object instanceof Mesh)) throw new Error('not a mesh');
  object.geometry.computeBoundingBox();
  const box = object.geometry.boundingBox;
  if (box === null) throw new Error('no bounds');
  return { graph, geometry: object.geometry, min: box.min.toArray(), max: box.max.toArray() };
};

const near = (actual: ReadonlyArray<number>, expected: ReadonlyArray<number>) =>
  actual.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis] ?? Number.NaN, 4));

test('a rounded box fills its size, centred, with creased normals', () => {
  const { graph, geometry, min, max } = shown(
    roundedBox({ width: 2, height: 1, depth: 0.5, radius: 0.1 }),
  );
  near(min, [-1, -0.5, -0.25]);
  near(max, [1, 0.5, 0.25]);
  // Creased normals come from a non-indexed copy: every face has its own corners.
  expect(geometry.index).toBeNull();
  expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count);
  graph.dispose();
});

test('a backdrop is a unit floor sweeping up into a wall, its flat front pulled forward', () => {
  const { graph, geometry, min, max } = shown(backdrop({ floor: 0.25, segments: 10 }));
  near(min, [-0.5, 0, -0.5]);
  near(max, [0.5, 1, 0.75]);
  // The front row lies flat on the floor; the back row is the top of the wall.
  const position = geometry.getAttribute('position');
  const heightsAt = (z: number) =>
    Array.from({ length: position.count }, (_, vertex) => vertex)
      .filter((vertex) => Math.abs(position.getZ(vertex) - z) < 1e-6)
      .map((vertex) => position.getY(vertex));
  expect(heightsAt(0.75).every((y) => Math.abs(y) < 1e-6)).toBe(true);
  expect(heightsAt(-0.5).every((y) => Math.abs(y - 1) < 1e-6)).toBe(true);
  graph.dispose();
});

test('changing a rounded box’s radius builds it again; the same description keeps it', () => {
  const graph = createSceneGraph();
  const show = (radius: number) =>
    graph.reconcile(
      scene({
        children: [mesh({ key: 'shape', geometry: roundedBox({ radius }), material: basic() })],
      }),
    );
  show(0.1);
  const first = graph.object('shape');
  const geometry = first instanceof Mesh ? first.geometry : undefined;
  show(0.1);
  expect(first instanceof Mesh ? first.geometry : undefined).toBe(geometry);
  show(0.2);
  expect(first instanceof Mesh ? first.geometry : undefined).not.toBe(geometry);
  graph.dispose();
});
