/**
 * The gizmo against three.js's own `TransformControls` (0.186.1), driven through the
 * same pointer handlers with the same cursor positions: each press and drag must land the
 * object where three's controls put it.
 */
import { expect, test } from 'bun:test';

import { Euler, Object3D, PerspectiveCamera, Raycaster, Scene, Vector2 } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

import {
  type Camera,
  dragGizmo,
  type Gizmo,
  gizmo,
  type GizmoHandle,
  gizmoHandleOf,
  gizmoNodes,
  hoverGizmo,
  movedAlike,
  perspectiveCamera,
  type Placement,
  pressGizmo,
  releaseGizmo,
} from '../src/index.ts';

const camera: Camera = perspectiveCamera({ position: [4, 3, 6], lookAt: [0, 0, 0] });

const hostCamera = (): PerspectiveCamera => {
  const host = new PerspectiveCamera(50, 1, 0.1, 100);
  host.position.fromArray(camera.position);
  host.lookAt(0, 0, 0);
  host.updateMatrixWorld();
  return host;
};

/** The ray through a cursor (−1 to 1, y up), as the scene reports it. */
const rayAt = (x: number, y: number) => {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(x, y), hostCamera());
  return {
    origin: raycaster.ray.origin.toArray(),
    direction: raycaster.ray.direction.toArray(),
  };
};

const tilted: Placement = {
  position: [0.5, 0.2, -0.3],
  rotation: [0.3, 0.6, -0.2],
  scale: [1, 2, 1],
};

/** Where three's controls put the object after a press and a drag. */
const oracle = (
  state: Gizmo,
  placement: Placement,
  handle: GizmoHandle,
  press: readonly [number, number],
  drag: readonly [number, number],
): Placement => {
  const host = hostCamera();
  const scene = new Scene();
  const object = new Object3D();
  object.position.fromArray(placement.position);
  object.rotation.set(...placement.rotation);
  object.scale.fromArray(placement.scale);
  scene.add(object);
  const controls = new TransformControls(host);
  scene.add(controls.getHelper());
  controls.attach(object);
  controls.setMode(state.mode);
  controls.setSpace(state.space);
  controls.setTranslationSnap(state.translationSnap);
  controls.setRotationSnap(state.rotationSnap);
  controls.setScaleSnap(state.scaleSnap);
  Reflect.set(controls, 'axis', handle.toUpperCase());
  scene.updateMatrixWorld(true);
  // Called as its DOM listeners call them, with the pointer in NDC.
  Reflect.apply(controls.pointerDown, controls, [{ x: press[0], y: press[1], button: 0 }]);
  scene.updateMatrixWorld(true);
  Reflect.apply(controls.pointerMove, controls, [{ x: drag[0], y: drag[1], button: -1 }]);
  const turn = new Euler().setFromQuaternion(object.quaternion);
  return {
    position: object.position.toArray(),
    rotation: [turn.x, turn.y, turn.z],
    scale: object.scale.toArray(),
  };
};

const ours = (
  state: Gizmo,
  placement: Placement,
  handle: GizmoHandle,
  press: readonly [number, number],
  drag: readonly [number, number],
): Placement | undefined =>
  dragGizmo(pressGizmo(state, placement, handle, rayAt(...press), camera), rayAt(...drag));

const expectClose = (actual: Placement | undefined, expected: Placement) => {
  for (const field of ['position', 'rotation', 'scale'] as const) {
    actual?.[field].forEach((value, axis) =>
      expect(value).toBeCloseTo(expected[field][axis] ?? Number.NaN, 6),
    );
  }
};

const press = [0.05, 0.02] as const;
const drag = [0.25, -0.1] as const;

test('every translate handle matches three’s TransformControls, in world and local space', () => {
  for (const space of ['world', 'local'] as const) {
    for (const handle of ['x', 'y', 'z', 'xy', 'yz', 'xz', 'xyz'] as const) {
      const state = gizmo({ space });
      expectClose(
        ours(state, tilted, handle, press, drag),
        oracle(state, tilted, handle, press, drag),
      );
    }
  }
});

test('rotate and scale match three’s too', () => {
  for (const handle of ['x', 'y', 'z'] as const) {
    for (const space of ['world', 'local'] as const) {
      const state = gizmo({ mode: 'rotate', space });
      expectClose(
        ours(state, tilted, handle, press, drag),
        oracle(state, tilted, handle, press, drag),
      );
    }
  }
  for (const handle of ['x', 'y', 'z', 'xy', 'xyz'] as const) {
    const state = gizmo({ mode: 'scale' });
    expectClose(
      ours(state, tilted, handle, press, drag),
      oracle(state, tilted, handle, press, drag),
    );
  }
});

test('snaps round as three’s do', () => {
  const cases = [
    gizmo({ translationSnap: 0.25 }),
    gizmo({ mode: 'rotate', rotationSnap: Math.PI / 12 }),
    gizmo({ mode: 'scale', scaleSnap: 0.5 }),
  ];
  for (const state of cases) {
    expectClose(ours(state, tilted, 'x', press, drag), oracle(state, tilted, 'x', press, drag));
  }
});

test('a gizmo draws keyed, pickable handles, highlights what is held, and lets go', () => {
  const state = hoverGizmo(gizmo(), 'y');
  const nodes = gizmoNodes('mover', state, tilted, camera);
  expect(nodes._tag).toBe('Group');
  const keys = nodes._tag === 'Group' ? nodes.children.map((child) => child.key) : [];
  expect(keys).toContain('mover:x:tip');
  expect(keys).toContain('mover:xy');
  expect(keys).toContain('mover:xyz');
  expect(gizmoHandleOf('mover', 'mover:y:stem')).toBe('y');
  expect(gizmoHandleOf('mover', 'mover:xz')).toBe('xz');
  expect(gizmoHandleOf('mover', 'other:x')).toBeUndefined();
  const held = pressGizmo(state, tilted, 'x', rayAt(...press), camera);
  expect(held.grab?.handle).toBe('x');
  expect(releaseGizmo(held).grab).toBeNull();
  expect(dragGizmo(releaseGizmo(held), rayAt(...drag))).toBeUndefined();
});

test('others move alike: the same offset, turn in place and change of scale', () => {
  const from: Placement = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  const to: Placement = { position: [1, 2, 0], rotation: [0, Math.PI / 2, 0], scale: [2, 1, 1] };
  const other: Placement = { position: [5, 0, 0], rotation: [0, 0, 0], scale: [1, 3, 1] };
  expectClose(movedAlike(from, to, other), {
    position: [6, 2, 0],
    rotation: [0, Math.PI / 2, 0],
    scale: [2, 3, 1],
  });
  // A drag that changed nothing leaves the other where it was.
  expectClose(movedAlike(tilted, tilted, other), other);
});
