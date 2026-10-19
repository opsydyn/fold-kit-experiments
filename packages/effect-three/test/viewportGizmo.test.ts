/**
 * The viewport gizmo against Drei's `GizmoHelper` (`bf6f4ad`), which turns its group by
 * the inverse of the camera's matrix each frame, and against what the camera shows.
 */
import { expect, test } from 'bun:test';

import { Matrix4, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three';

import {
  cameraAlong,
  createSceneGraph,
  hud,
  orthographicCamera,
  perspectiveCamera,
  scene,
  type ViewAxis,
  viewportAxisOf,
  viewportGizmoNodes,
} from '../src/kernel/index.ts';

const camera = perspectiveCamera({ position: [4, 3, 6], lookAt: [0.5, 0, -1] });

test('the gizmo turns by the inverse of the camera’s matrix, as Drei’s', () => {
  const host = new PerspectiveCamera();
  host.position.fromArray(camera.position);
  host.lookAt(...camera.lookAt);
  host.updateMatrix();
  const drei = new Quaternion().setFromRotationMatrix(new Matrix4().copy(host.matrix).invert());
  const graph = createSceneGraph();
  graph.reconcile(scene({ hud: hud({ children: [viewportGizmoNodes('gizmo', camera)] }) }));
  const ours = graph.hud()?.graph.object('gizmo')?.quaternion ?? new Quaternion();
  expect(Math.abs(ours.dot(drei))).toBeCloseTo(1, 9);
});

test('each head shows where the camera sees its axis point', () => {
  const ortho = orthographicCamera({ position: [3, 4, 5], lookAt: [0, 0, 0] });
  const graph = createSceneGraph();
  graph.resize(800, 600);
  graph.reconcile(
    scene({
      camera: ortho,
      hud: hud({ alignment: 'center-center', children: [viewportGizmoNodes('gizmo', ortho)] }),
    }),
  );
  const huded = graph.hud()?.graph;
  huded?.scene.updateMatrixWorld();
  graph.camera.updateMatrixWorld();
  const onScreen = (object: Object3D | undefined, through = huded?.camera ?? graph.camera) =>
    (object?.getWorldPosition(new Vector3()) ?? new Vector3()).project(through);
  for (const axis of ['x', 'y', 'z'] as const) {
    const seen = onScreen(huded?.object(`gizmo:${axis}`));
    const tip = new Object3D();
    tip.position.fromArray(axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]);
    tip.updateMatrixWorld();
    const shown = onScreen(tip, graph.camera);
    // Both cameras are orthographic: the same direction on screen, from the middle.
    expect(Math.atan2(seen.y * 300, seen.x * 400)).toBeCloseTo(
      Math.atan2(shown.y * 300, shown.x * 400),
      6,
    );
  }
});

test('heads are named by axis, any part of them, and only this gizmo’s', () => {
  expect(viewportAxisOf('gizmo', 'gizmo:x:disc')).toBe('x');
  expect(viewportAxisOf('gizmo', 'gizmo:-z:disc')).toBe('-z');
  expect(viewportAxisOf('gizmo', 'gizmo:y:letter:1')).toBe('y');
  expect(viewportAxisOf('gizmo', 'gizmo:x:bar')).toBe('x');
  expect(viewportAxisOf('gizmo', 'other:x:disc')).toBeUndefined();
  const bare = viewportGizmoNodes('gizmo', camera, { hideNegativeAxes: true });
  const keys = bare._tag === 'Group' ? bare.children.map((child) => child.key) : [];
  expect(keys).toContain('gizmo:x');
  expect(keys).not.toContain('gizmo:-x');
});

test('cameraAlong looks from an axis at the same target, as far away', () => {
  const cases: ReadonlyArray<readonly [ViewAxis, readonly [number, number, number]]> = [
    ['x', [1, 0, 0]],
    ['-z', [0, 0, -1]],
    ['y', [0, 1, 0]],
  ];
  const distance = new Vector3(...camera.position).distanceTo(new Vector3(...camera.lookAt));
  for (const [axis, [x, y, z]] of cases) {
    const along = cameraAlong(camera, axis);
    expect(along.lookAt).toEqual(camera.lookAt);
    along.position.forEach((value, index) =>
      expect(value).toBeCloseTo(
        (camera.lookAt[index] ?? 0) + ([x, y, z][index] ?? 0) * distance,
        4,
      ),
    );
  }
  // Off the pole by a hair, so the camera's up still has a direction.
  expect(cameraAlong(camera, '-y').position[2]).toBeGreaterThan(camera.lookAt[2]);
});
