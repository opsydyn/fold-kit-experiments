import { expect, test } from 'bun:test';

import {
  BackSide,
  type Camera,
  GridHelper,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  ShaderMaterial,
} from 'three';

import { createSceneGraph, grid, scene, shaderGrid } from '../src/kernel/index.ts';
import { webglKit } from '../src/webgl/index.ts';

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

/** What the renderer does before drawing the grid: hand it the camera drawing it. */
const drawn = (object: Object3D | undefined, camera: Camera): void => {
  if (object !== undefined) Reflect.apply(object.onBeforeRender, object, [null, null, camera]);
};

test('a shader grid is a plane with Drei’s grid settings in its uniforms', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(
    scene({ children: [shaderGrid({ key: 'floor', size: [10, 10], sectionColor: 0xff0000 })] }),
  );
  const object = graph.object('floor');
  if (!(object instanceof Mesh) || !(object.material instanceof ShaderMaterial)) {
    throw new Error('not a shader grid');
  }
  const { uniforms } = object.material;
  expect(uniforms['cellSize']?.value).toBe(0.5);
  expect(uniforms['fadeDistance']?.value).toBe(100);
  expect(uniforms['sectionColor']?.value.getHex()).toBe(0xff0000);
  expect(object.material.side).toBe(BackSide);
  expect(object.frustumCulled).toBe(false);
  expect(object.geometry.parameters).toMatchObject({ width: 10, height: 10 });

  // A new look updates the uniforms in place; a new size makes a new plane.
  const before = object.geometry;
  graph.reconcile(scene({ children: [shaderGrid({ key: 'floor', size: [10, 10], cellSize: 2 })] }));
  expect(uniforms['cellSize']?.value).toBe(2);
  expect(object.geometry).toBe(before);
  graph.reconcile(scene({ children: [shaderGrid({ key: 'floor', size: [20, 4] })] }));
  expect(object.geometry).not.toBe(before);
  expect(object.geometry.parameters).toMatchObject({ width: 20, height: 4 });
  graph.dispose();
});

test('before each draw, the grid learns where the camera stands over its plane', () => {
  const graph = createSceneGraph({ kit: webglKit });
  graph.reconcile(
    scene({ children: [shaderGrid({ key: 'floor', position: [0, 2, 0], infinite: true })] }),
  );
  const object = graph.object('floor');
  graph.scene.updateMatrixWorld();
  const camera = new PerspectiveCamera();
  camera.position.set(3, 10, -4);
  camera.updateMatrixWorld();
  drawn(object, camera);
  const material = object instanceof Mesh ? object.material : undefined;
  const uniforms = material instanceof ShaderMaterial ? material.uniforms : {};
  // The camera dropped onto the grid's plane (y = 2), and the plane's origin.
  expect(uniforms['cameraOnPlane']?.value.toArray()).toEqual([3, 2, -4]);
  expect(uniforms['planeOrigin']?.value.toArray()).toEqual([0, 2, 0]);
  graph.dispose();
});
