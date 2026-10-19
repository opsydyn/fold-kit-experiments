/**
 * Box selection against three.js's own `SelectionBox` (0.186.1), over the same points
 * seen through the same camera: every box must select what three's selects, for points
 * the camera can show (three's depth limits differ; see `boxSelect.ts`).
 */
import { expect, test } from 'bun:test';

import {
  Mesh,
  type OrthographicCamera as HostOrthographic,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import { SelectionBox } from 'three/addons/interactive/SelectionBox.js';

import {
  type BoxCorner,
  boxSelect,
  type Camera,
  orthographicCamera,
  perspectiveCamera,
  type Selectable,
} from '../src/index.ts';
import { seededRandom } from '../src/kernel/seeded.ts';

const size = { width: 800, height: 500 };

const host = (camera: Camera): PerspectiveCamera | HostOrthographic => {
  const fitted =
    camera._tag === 'Perspective'
      ? new PerspectiveCamera(camera.fov, size.width / size.height, camera.near, camera.far)
      : new OrthographicCamera(
          size.width / -2,
          size.width / 2,
          size.height / 2,
          size.height / -2,
          camera.near,
          camera.far,
        );
  if (fitted instanceof OrthographicCamera && camera._tag === 'Orthographic') {
    fitted.zoom = camera.zoom;
  }
  fitted.position.fromArray(camera.position);
  fitted.lookAt(...camera.lookAt);
  fitted.updateMatrixWorld();
  fitted.updateProjectionMatrix();
  return fitted;
};

/**
 * Points scattered across the camera's view and a little past its sides, between
 * projected depths `near` and `far` (−1 to 1): away from the near plane, where three's
 * perspective box tilts.
 */
const scatter = (
  camera: Camera,
  count: number,
  near: number,
  far: number,
): ReadonlyArray<Selectable> => {
  const random = seededRandom(7);
  const seen = host(camera);
  const pointAt = (index: number): Selectable => {
    const depth = near + random() * (far - near);
    const at = new Vector3(random() * 2.4 - 1.2, random() * 2.4 - 1.2, depth);
    return { key: `p${index}`, at: at.unproject(seen).toArray() };
  };
  return Array.from({ length: count }, (_, index) => pointAt(index));
};

/** What three's box selects: a small sphere at each point, by name. */
const oracle = (
  camera: Camera,
  points: ReadonlyArray<Selectable>,
  from: BoxCorner,
  to: BoxCorner,
): ReadonlyArray<string> => {
  const scene = new Scene();
  const geometry = new SphereGeometry(0.01);
  for (const point of points) {
    const marker = new Mesh(geometry);
    marker.name = point.key;
    marker.position.fromArray(point.at);
    scene.add(marker);
  }
  scene.updateMatrixWorld(true);
  const selection = new SelectionBox(host(camera), scene);
  return selection
    .select(new Vector3(from.x, from.y, 0.5), new Vector3(to.x, to.y, 0.5))
    .map((object) => object.name);
};

const boxes: ReadonlyArray<readonly [BoxCorner, BoxCorner]> = [
  [
    { x: -0.4, y: 0.5 },
    { x: 0.3, y: -0.2 },
  ],
  [
    { x: 0.6, y: -0.7 },
    { x: -0.1, y: 0.1 },
  ],
  [
    { x: -1, y: -1 },
    { x: 1, y: 1 },
  ],
  [
    { x: 0.2, y: 0.2 },
    { x: 0.25, y: 0.25 },
  ],
];

test('a perspective box selects what three’s SelectionBox selects', () => {
  const camera = perspectiveCamera({ position: [4, 3, 6], lookAt: [0, 0, 0], far: 100 });
  const points = scatter(camera, 400, 0.9, 0.999);
  for (const [from, to] of boxes) {
    const ours = boxSelect(camera, size, from, to, points);
    expect([...ours].toSorted()).toEqual([...oracle(camera, points, from, to)].toSorted());
  }
});

test('an orthographic box does too', () => {
  const camera = orthographicCamera({ position: [0, 8, 6], lookAt: [0, 0, 0], zoom: 60, far: 14 });
  const points = scatter(camera, 400, 0, 0.9);
  for (const [from, to] of boxes) {
    const ours = boxSelect(camera, size, from, to, points);
    expect([...ours].toSorted()).toEqual([...oracle(camera, points, from, to)].toSorted());
  }
});

test('nothing behind the camera or past far is selected, in the candidates’ order', () => {
  const whole = [
    { x: -1, y: -1 },
    { x: 1, y: 1 },
  ] as const;
  const points: ReadonlyArray<Selectable> = [
    { key: 'behind', at: [0, 0, 10] },
    { key: 'beyond', at: [0, 0, -200] },
    { key: 'b', at: [0.1, 0, 0] },
    { key: 'a', at: [-0.1, 0, 0] },
  ];
  const lenses = [
    perspectiveCamera({ position: [0, 0, 5], lookAt: [0, 0, 0], far: 100 }),
    orthographicCamera({ position: [0, 0, 5], lookAt: [0, 0, 0], far: 100 }),
  ];
  for (const camera of lenses) {
    expect(boxSelect(camera, size, ...whole, points)).toEqual(['b', 'a']);
  }
});
