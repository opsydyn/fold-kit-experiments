/**
 * `orbit` against three.js's own `OrbitControls` (0.186.1), driven through the same
 * mouse and wheel handlers a browser would call, on a headless camera.
 */
import { expect, test } from 'bun:test';

import { OrthographicCamera, PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import {
  type Camera,
  type Gesture,
  noModifiers,
  orbit,
  orbitKey,
  type OrbitOptions,
  orbitOptions,
  orthographicCamera,
  perspectiveCamera,
  type Vec3,
} from '../src/kernel/index.ts';

const area = { width: 800, height: 600 };
/** A gesture's area, and where in it the pointer is: the middle. */
const region = { ...area, x: 0, y: 0 };

/** A host camera placed and fitted as the kernel places and fits it. */
const hostOf = (camera: Camera): PerspectiveCamera | OrthographicCamera => {
  const host =
    camera._tag === 'Perspective'
      ? new PerspectiveCamera(camera.fov, area.width / area.height, camera.near, camera.far)
      : new OrthographicCamera(
          area.width / -2,
          area.width / 2,
          area.height / 2,
          area.height / -2,
          camera.near,
          camera.far,
        );
  if (host instanceof OrthographicCamera && camera._tag === 'Orthographic') {
    host.zoom = camera.zoom;
  }
  host.updateProjectionMatrix();
  host.position.fromArray(camera.position);
  host.lookAt(...camera.lookAt);
  host.updateMatrixWorld();
  return host;
};

type Result = { readonly position: Vec3; readonly target: Vec3; readonly zoom: number };

/** Calls one of the controls' internal handlers, as its DOM listeners do. */
const handle = (controls: OrbitControls, name: string, ...args: ReadonlyArray<unknown>): void => {
  Reflect.apply(Reflect.get(controls, name), controls, args);
};

const at = (x: number, y: number) => ({ clientX: x, clientY: y });

/** A gesture's cursor (−1 to 1, y up) in client pixels. */
const clientOf = (gesture: Gesture) => ({
  clientX: ((gesture.x + 1) / 2) * area.width,
  clientY: ((1 - gesture.y) / 2) * area.height,
});

/** What three's controls make of a gesture. */
const oracle = (camera: Camera, gesture: Gesture, options: Partial<OrbitOptions>): Result => {
  const host = hostOf(camera);
  const controls = new OrbitControls(host);
  Reflect.set(controls, 'domElement', {
    clientWidth: area.width,
    clientHeight: area.height,
    getBoundingClientRect: () => ({ left: 0, top: 0, ...area }),
  });
  Object.assign(controls, options);
  controls.target.fromArray(camera.lookAt);
  controls.update();
  host.updateMatrixWorld();
  if (gesture._tag === 'Wheel') {
    const event = {
      deltaMode: 0,
      deltaY: gesture.deltaY,
      ctrlKey: gesture.modifiers.control,
      ...clientOf(gesture),
    };
    handle(
      controls,
      '_handleMouseWheel',
      Reflect.apply(Reflect.get(controls, '_customWheelEvent'), controls, [event]),
    );
  } else if (gesture._tag === 'Drag') {
    const action = ({ 0: 'Rotate', 1: 'Dolly', 2: 'Pan' } as const)[gesture.button] ?? 'Rotate';
    const swapped =
      gesture.modifiers.shift && action !== 'Dolly'
        ? ({ Rotate: 'Pan', Pan: 'Rotate' } as const)[action]
        : action;
    // Pressed where the gesture says (a dolly aims there); moved by the deltas.
    const press = clientOf(gesture);
    handle(controls, `_handleMouseDown${swapped}`, press);
    // three 0.186's _handleMouseDownDolly aims at (clientX, clientX), a typo; aim it at the
    // press point, as orbit does.
    if (swapped === 'Dolly')
      handle(controls, '_updateZoomParameters', press.clientX, press.clientY);
    handle(
      controls,
      `_handleMouseMove${swapped}`,
      at(press.clientX + gesture.deltaX, press.clientY + gesture.deltaY),
    );
  }
  return {
    position: host.position.toArray(),
    target: controls.target.toArray(),
    zoom: host.zoom,
  };
};

const resultOf = (camera: Camera): Result => ({
  position: camera.position,
  target: camera.lookAt,
  zoom: camera._tag === 'Orthographic' ? camera.zoom : 1,
});

const expectClose = (actual: Result, expected: Result): void => {
  for (const [a, b] of [
    [actual.position, expected.position],
    [actual.target, expected.target],
  ] as const) {
    for (let i = 0; i < 3; i++) expect(a[i] ?? NaN).toBeCloseTo(b[i] ?? NaN, 6);
  }
  expect(actual.zoom).toBeCloseTo(expected.zoom, 6);
};

const drag = (
  button: number,
  deltaX: number,
  deltaY: number,
  shift = false,
  cursor: readonly [number, number] = [0, 0],
): Gesture => ({
  _tag: 'Drag',
  button,
  modifiers: { ...noModifiers, shift },
  deltaX,
  deltaY,
  ...area,
  x: cursor[0],
  y: cursor[1],
});

const wheel = (
  deltaY: number,
  control = false,
  cursor: readonly [number, number] = [0, 0],
): Gesture => ({
  _tag: 'Wheel',
  modifiers: { ...noModifiers, control },
  deltaX: 0,
  deltaY,
  ...area,
  x: cursor[0],
  y: cursor[1],
});

/** A small deterministic generator (mulberry32), so failures replay. */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const cameras: ReadonlyArray<Camera> = [
  perspectiveCamera({ fov: 40, position: [0, 5.2, 7.5], lookAt: [0, 0.3, 0] }),
  perspectiveCamera({ fov: 70, position: [-3, 1, -2], lookAt: [1, 0.5, 2] }),
  orthographicCamera({ zoom: 62, position: [0, 5.2, 7.5], lookAt: [0, 0.3, 0] }),
  orthographicCamera({ zoom: 20, position: [4, 4, 4] }),
];

const optionSets: ReadonlyArray<Partial<OrbitOptions>> = [
  {},
  { rotateSpeed: 0.5, zoomSpeed: 2, panSpeed: 1.5 },
  { minPolarAngle: 0.3, maxPolarAngle: 1.2, minDistance: 3, maxDistance: 12 },
  { minAzimuthAngle: -0.5, maxAzimuthAngle: 0.5, minZoom: 30, maxZoom: 80 },
  { screenSpacePanning: false },
];

test('every drag and wheel step matches three.js OrbitControls', () => {
  const next = random(7);
  for (const camera of cameras) {
    for (const options of optionSets) {
      for (let i = 0; i < 12; i++) {
        const dx = (next() - 0.5) * 400;
        const dy = (next() - 0.5) * 400;
        const shift = next() < 0.3;
        for (const gesture of [
          drag(0, dx, dy, shift),
          drag(1, dx, dy),
          drag(2, dx, dy, shift),
          wheel(dy, shift),
        ]) {
          expectClose(
            resultOf(orbit(camera, gesture, orbitOptions(options))),
            oracle(camera, gesture, options),
          );
        }
      }
    }
  }
});

test('zooming toward the cursor matches OrbitControls with zoomToCursor', () => {
  const next = random(11);
  for (const camera of cameras) {
    for (const options of [
      { zoomToCursor: true },
      { zoomToCursor: true, screenSpacePanning: false },
      { zoomToCursor: true, minDistance: 3, maxDistance: 12, minZoom: 30, maxZoom: 80 },
    ]) {
      for (let i = 0; i < 12; i++) {
        const cursor = [next() * 2 - 1, next() * 2 - 1] as const;
        const delta = (next() - 0.5) * 600;
        for (const gesture of [wheel(delta, false, cursor), drag(1, 0, delta, false, cursor)]) {
          expectClose(
            resultOf(orbit(camera, gesture, orbitOptions(options))),
            oracle(camera, gesture, options),
          );
        }
      }
    }
  }
});

test('arrow keys pan, and turn with a modifier, as OrbitControls does', () => {
  for (const camera of cameras) {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const) {
      for (const shift of [false, true]) {
        const host = hostOf(camera);
        const controls = new OrbitControls(host);
        Reflect.set(controls, 'domElement', { clientWidth: area.width, clientHeight: area.height });
        controls.target.fromArray(camera.lookAt);
        controls.update();
        host.updateMatrixWorld();
        handle(controls, '_handleKeyDown', {
          code: key,
          shiftKey: shift,
          ctrlKey: false,
          metaKey: false,
          preventDefault: () => undefined,
        });
        expectClose(resultOf(orbitKey(camera, key, { ...noModifiers, shift }, area)), {
          position: host.position.toArray(),
          target: controls.target.toArray(),
          zoom: host.zoom,
        });
      }
    }
  }
});

test('a pinch spreading to twice the distance halves it, or doubles an orthographic zoom', () => {
  const pinch: Gesture = { _tag: 'Pinch', scale: 2, deltaX: 0, deltaY: 0, ...region };
  const near = orbit(perspectiveCamera({ position: [0, 0, 8] }), pinch);
  expect(near.position[2]).toBeCloseTo(4, 9);
  const zoomed = orbit(orthographicCamera({ zoom: 10, position: [0, 0, 8] }), pinch);
  expect(zoomed._tag === 'Orthographic' ? zoomed.zoom : 0).toBeCloseTo(20, 9);
  expect(zoomed.position[2]).toBeCloseTo(8, 9);
});

test('disabled actions leave the camera as it was', () => {
  const camera = perspectiveCamera({ position: [1, 2, 3] });
  const still = orbitOptions({ enableRotate: false, enableZoom: false, enablePan: false });
  for (const gesture of [drag(0, 50, 20), drag(1, 0, 40), drag(2, 30, 30), wheel(100)]) {
    expect(orbit(camera, gesture, still)).toBe(camera);
  }
});
