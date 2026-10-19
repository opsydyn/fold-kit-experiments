/**
 * Pivot controls against Drei's `PivotControls` (`bf6f4ad`, `src/web/pivotControls/`,
 * MIT): its handlers, replayed here with three's matrices as Drei composes them (the
 * world delta premultiplied onto the object's world matrix), must put the object where
 * ours do. `calculateOffset`, `calculateAngle` and `decomposeIntoBasis` are Drei's own.
 */
import { expect, test } from 'bun:test';

import {
  Euler,
  Matrix4,
  Plane,
  Quaternion,
  Ray,
  Raycaster,
  PerspectiveCamera,
  Vector2,
  Vector3,
} from 'three';

import {
  createPicker,
  createSceneGraph,
  dragPivot,
  hoverPivot,
  pivot,
  type PivotHandle,
  pivotHandleOf,
  pivotNodes,
  type Placement,
  perspectiveCamera,
  pressPivot,
  releasePivot,
  scene,
} from '../src/index.ts';

// Drei's helpers, as they are in `AxisArrow.tsx`, `PlaneSlider.tsx` and `AxisRotator.tsx`.
const calculateOffset = (
  clickPoint: Vector3,
  normal: Vector3,
  rayStart: Vector3,
  rayDir: Vector3,
) => {
  const e1 = normal.dot(normal);
  const e2 = normal.dot(clickPoint) - normal.dot(rayStart);
  const e3 = normal.dot(rayDir);
  if (e3 === 0) return -e2 / e1;
  const vec1 = rayDir
    .clone()
    .multiplyScalar(e1 / e3)
    .sub(normal);
  const vec2 = rayDir
    .clone()
    .multiplyScalar(e2 / e3)
    .add(rayStart)
    .sub(clickPoint);
  return -vec1.dot(vec2) / vec1.dot(vec1);
};
const decomposeIntoBasis = (e1: Vector3, e2: Vector3, offset: Vector3) => {
  const i1 =
    Math.abs(e1.x) >= Math.abs(e1.y) && Math.abs(e1.x) >= Math.abs(e1.z)
      ? 0
      : Math.abs(e1.y) >= Math.abs(e1.x) && Math.abs(e1.y) >= Math.abs(e1.z)
        ? 1
        : 2;
  const order = [0, 1, 2].sort(
    (a, b) => Math.abs(e2.getComponent(b)) - Math.abs(e2.getComponent(a)),
  );
  const i2 = i1 === order[0] ? (order[1] ?? 0) : (order[0] ?? 0);
  const [a1, a2] = [e1.getComponent(i1), e1.getComponent(i2)];
  const [b1, b2] = [e2.getComponent(i1), e2.getComponent(i2)];
  const [c1, c2] = [offset.getComponent(i1), offset.getComponent(i2)];
  const y = (c2 - c1 * (a2 / a1)) / (b2 - b1 * (a2 / a1));
  const x = (c1 - y * b1) / a1;
  return [x, y] as const;
};
const calculateAngle = (
  clickPoint: Vector3,
  intersectionPoint: Vector3,
  origin: Vector3,
  e1: Vector3,
  e2: Vector3,
) => {
  const clickDir = clickPoint.clone().sub(origin);
  const intersectionDir = intersectionPoint.clone().sub(origin);
  const uClick = clickDir.dot(e1) / e1.dot(e1);
  const vClick = clickDir.dot(e2) / e2.dot(e2);
  const uIntersection = intersectionDir.dot(e1) / e1.dot(e1);
  const vIntersection = intersectionDir.dot(e2) / e2.dot(e2);
  return Math.atan2(vIntersection, uIntersection) - Math.atan2(vClick, uClick);
};

const object: Placement = {
  position: [0.5, 0.2, -0.3],
  rotation: [0.3, 0.6, -0.2],
  scale: [1, 2, 1],
};
const size = 1.5;

const camera = new PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(4, 3, 6);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

const rayAt = (x: number, y: number) => {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(x, y), camera);
  return raycaster.ray;
};

const axes = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) } as const;
const planes = { z: ['x', 'y'], y: ['z', 'x'], x: ['y', 'z'] } as const;

/** The object's world matrix, and Drei's gizmo group's: placed and turned, never scaled. */
const objectMatrix = () =>
  new Matrix4().compose(
    new Vector3(...object.position),
    new Quaternion().setFromEuler(new Euler(...object.rotation)),
    new Vector3(...object.scale),
  );
const gizmoMatrix = () =>
  new Matrix4().compose(
    new Vector3(...object.position),
    new Quaternion().setFromEuler(new Euler(...object.rotation)),
    new Vector3(1, 1, 1),
  );

/** Drei's slider and rotator groups: the gizmo's, onto their plane (`makeBasis`). */
const planeMatrix = (axis: 'x' | 'y' | 'z') => {
  const [first, second] = planes[axis];
  const basis = new Matrix4().makeBasis(
    axes[first],
    axes[second],
    axes[first].clone().cross(axes[second]),
  );
  return gizmoMatrix().multiply(basis);
};

const column = (matrix: Matrix4, index: number) =>
  new Vector3().setFromMatrixColumn(matrix, index).normalize();

/** Drei's PlaneSlider and AxisRotator ray: the line's meeting with the plane, either way. */
const meet = (ray: Ray, plane: Plane) => {
  const found = new Vector3();
  const line = ray.clone();
  line.intersectPlane(plane, found);
  line.direction.negate();
  line.intersectPlane(plane, found);
  return found;
};

/** What Drei's handler for `handle` gives as the object's new world matrix. */
const drei = (handle: PivotHandle, click: Vector3, ray: Ray): Matrix4 => {
  const [kind, axis] = handle.split('-') as [string, 'x' | 'y' | 'z'];
  const origin = new Vector3(...object.position);
  const delta = new Matrix4();
  if (kind === 'arrow' || kind === 'sphere') {
    const dir = axes[axis]
      .clone()
      .applyMatrix4(new Matrix4().extractRotation(gizmoMatrix()))
      .normalize();
    const offset = calculateOffset(click, dir, ray.origin, ray.direction);
    if (kind === 'arrow') delta.makeTranslation(dir.x * offset, dir.y * offset, dir.z * offset);
    else {
      const upscale = 2 ** ((offset / size) * 0.2);
      const scale = new Vector3(1, 1, 1);
      scale.setComponent({ x: 0, y: 1, z: 2 }[axis], upscale);
      const mPLG = gizmoMatrix();
      delta.makeScale(scale.x, scale.y, scale.z).premultiply(mPLG).multiply(mPLG.clone().invert());
    }
  } else {
    const matrix = planeMatrix(axis);
    const e1 = column(matrix, 0);
    const e2 = column(matrix, 1);
    const normal = column(matrix, 2);
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, origin);
    const found = meet(ray, plane);
    if (kind === 'slider') {
      const [x, y] = decomposeIntoBasis(e1, e2, found.clone().sub(click));
      delta.makeTranslation(x * e1.x + y * e2.x, x * e1.y + y * e2.y, x * e1.z + y * e2.z);
    } else {
      const angle = calculateAngle(click, found, origin, e1, e2);
      delta.makeRotationAxis(normal, angle);
      delta.setPosition(origin.clone().applyMatrix4(delta).sub(origin).negate());
    }
  }
  return objectMatrix().premultiply(delta);
};

/** Where each handle is pressed: on it, as a pointer would hit it. */
const clickOn = (handle: PivotHandle): Vector3 => {
  const [kind, axis] = handle.split('-') as [string, 'x' | 'y' | 'z'];
  const [first, second] = planes[axis];
  const local = {
    arrow: axes[axis].clone().multiplyScalar(size * 0.9),
    sphere: axes[axis].clone().multiplyScalar(size * 1.2),
    slider: axes[first]
      .clone()
      .add(axes[second])
      .multiplyScalar((size / 7) * 1.7),
    rotator: axes[first]
      .clone()
      .add(axes[second])
      .normalize()
      .multiplyScalar(size * 0.65),
  }[kind as 'arrow'];
  return local.applyMatrix4(gizmoMatrix());
};

const expectSame = (ours: Placement | undefined, theirs: Matrix4) => {
  const position = new Vector3();
  const turn = new Quaternion();
  const scale = new Vector3();
  theirs.decompose(position, turn, scale);
  const ourTurn = new Quaternion().setFromEuler(new Euler(...(ours?.rotation ?? [0, 0, 0])));
  ours?.position.forEach((value, index) =>
    expect(value).toBeCloseTo(position.getComponent(index), 6),
  );
  ours?.scale.forEach((value, index) => expect(value).toBeCloseTo(scale.getComponent(index), 6));
  expect(Math.abs(ourTurn.dot(turn))).toBeCloseTo(1, 9);
};

const every: ReadonlyArray<PivotHandle> = (
  ['arrow', 'slider', 'rotator', 'sphere'] as const
).flatMap((kind) => (['x', 'y', 'z'] as const).map((axis): PivotHandle => `${kind}-${axis}`));

test('every handle puts the object where Drei’s PivotControls would', () => {
  const state = pivot({ scale: size });
  for (const handle of every) {
    for (const [x, y] of [
      [0.25, -0.1],
      [-0.3, 0.2],
    ] as const) {
      const click = clickOn(handle);
      const ray = rayAt(x, y);
      const held = pressPivot(state, object, handle, click.toArray());
      const ours = dragPivot(held, {
        origin: ray.origin.toArray(),
        direction: ray.direction.toArray(),
      });
      expectSame(ours, drei(handle, click, ray));
    }
  }
});

test('snapping turns by tens of degrees and scales by tenths, as Drei’s shift', () => {
  const ray = rayAt(0.25, -0.1);
  const asRay = { origin: ray.origin.toArray(), direction: ray.direction.toArray() };
  const turned = dragPivot(
    pressPivot(pivot({ scale: size }), object, 'rotator-y', clickOn('rotator-y').toArray()),
    asRay,
    { snap: true },
  );
  const before = new Quaternion().setFromEuler(new Euler(...object.rotation));
  const after = new Quaternion().setFromEuler(new Euler(...(turned?.rotation ?? [0, 0, 0])));
  const degrees = (before.angleTo(after) * 180) / Math.PI;
  expect(Math.abs(degrees - Math.round(degrees / 10) * 10)).toBeLessThan(1e-6);
  const scaled = dragPivot(
    pressPivot(pivot({ scale: size }), object, 'sphere-x', clickOn('sphere-x').toArray()),
    asRay,
    { snap: true },
  );
  const factor = (scaled?.scale[0] ?? 0) / object.scale[0];
  expect(Math.abs(factor * 10 - Math.round(factor * 10))).toBeLessThan(1e-9);
});

test('pivots draw keyed, pickable handles, highlight what is held, and let go', () => {
  const state = hoverPivot(pivot(), 'slider-z');
  const nodes = pivotNodes('pivot', state, object);
  const keys = nodes._tag === 'Group' ? nodes.children.map((child) => child.key) : [];
  expect(keys).toContain('pivot:arrow-x:cone');
  expect(keys).toContain('pivot:slider-y');
  expect(keys).toContain('pivot:rotator-z');
  expect(keys).toContain('pivot:sphere-z');
  expect(pivotHandleOf('pivot', 'pivot:rotator-y:hit:3')).toBe('rotator-y');
  expect(pivotHandleOf('pivot', 'pivot:arrow-z:stem')).toBe('arrow-z');
  expect(pivotHandleOf('pivot', 'other:arrow-z')).toBeUndefined();
  const bare = pivotNodes('pivot', pivot({ disableRotations: true, disableScaling: true }), object);
  expect(bare._tag === 'Group' ? bare.children.length : 0).toBe(12);
  const held = pressPivot(state, object, 'arrow-x', [0, 0, 0]);
  expect(held.grab?.handle).toBe('arrow-x');
  expect(
    dragPivot(releasePivot(held), { origin: [0, 0, 5], direction: [0, 0, -1] }),
  ).toBeUndefined();
});

/** A scene with the pivot on the object, ready to pick. */
const pickable = () => {
  const graph = createSceneGraph();
  graph.resize(800, 800);
  graph.reconcile(
    scene({
      camera: perspectiveCamera({ fov: 50, position: [4, 3, 6], lookAt: [0, 0, 0] }),
      children: [pivotNodes('pivot', pivot({ scale: size }), object)],
    }),
  );
  graph.scene.updateMatrixWorld(true);
  graph.camera.updateMatrixWorld();
  return { graph, picker: createPicker(graph) };
};

/** The handle under `point` on the canvas, `pixels` above it. */
const handleAt = ({ graph, picker }: ReturnType<typeof pickable>, point: Vector3, pixels = 0) =>
  ((seen) => pivotHandleOf('pivot', picker.pick(seen.x, seen.y + pixels / 400)?.key ?? ''))(
    point.project(graph.camera),
  );

test('the pointer finds every handle where it is drawn: arrows and arcs by their hit shapes', () => {
  const picking = pickable();
  for (const handle of every) expect(handleAt(picking, clickOn(handle))).toBe(handle);
  // Four pixels off a thin line, only the unseen hit shape round it is there.
  expect(handleAt(picking, clickOn('arrow-x'), 4)).toBe('arrow-x');
  expect(handleAt(picking, clickOn('rotator-y'), 4)).toBe('rotator-y');
});
