import { expect, test } from 'bun:test';

import {
  autoRotated,
  createPicker,
  createPointerTracker,
  createSceneGraph,
  noModifiers,
  orbit,
  perspectiveCamera,
  type SceneEvent,
  scene,
  view,
} from '../src/kernel/index.ts';

const near = (values: ReadonlyArray<number>) => values.map((v) => Math.round(v * 1e6) / 1e6 || 0);

test('a camera with autoRotate turns round its target, as OrbitControls, in scene time', () => {
  const graph = createSceneGraph();
  graph.reconcile(scene({ camera: perspectiveCamera({ position: [0, 0, 5], autoRotate: 2 }) }));
  graph.tick(0);
  expect(graph.needsFrame()).toBe(true);
  // Speed 2 is an orbit every 30 seconds: a quarter in 7.5, clockwise seen from above.
  graph.tick(7.5);
  expect(near(graph.camera.position.toArray())).toEqual([-5, 0, 0]);
  expect(near(graph.turned(undefined) ?? [])).toEqual([-5, 0, 0]);
  // Frame rate does not matter: the next quarter in many small steps.
  for (let frame = 1; frame <= 450; frame++) graph.tick(7.5 + frame / 60);
  expect(near(graph.camera.position.toArray())).toEqual([0, 0, -5]);
  graph.dispose();
});

test('turning holds while a gesture is pressed, and a new pose turns on from there', () => {
  const graph = createSceneGraph();
  const at = (position: readonly [number, number, number], fov = 50) =>
    scene({ camera: perspectiveCamera({ position, fov, autoRotate: 2 }) });
  graph.reconcile(at([0, 0, 5]));
  graph.tick(0);
  graph.tick(7.5);
  graph.holdCameras(true);
  graph.tick(15);
  expect(near(graph.camera.position.toArray())).toEqual([-5, 0, 0]);
  graph.holdCameras(false);
  // A lens change keeps the turn; a new position starts from it, unturned.
  graph.reconcile(at([0, 0, 5], 60));
  expect(near(graph.camera.position.toArray())).toEqual([-5, 0, 0]);
  graph.reconcile(at([0, 0, 4], 60));
  expect(graph.camera.position.toArray()).toEqual([0, 0, 4]);
  expect(graph.turned(undefined)).toBeUndefined();
  graph.dispose();
});

test('a gesture on a turned camera first says where it got to; orbiting goes on from there', () => {
  const graph = createSceneGraph();
  let camera = perspectiveCamera({ position: [0, 0, 5], autoRotate: 2 });
  graph.reconcile(scene({ gestures: 'scene', camera }));
  graph.resize(800, 600);
  const tracker = createPointerTracker(createPicker(graph));
  graph.tick(0);
  graph.tick(7.5);
  const events: Array<SceneEvent> = [];
  events.push(...tracker.input({ _tag: 'PointerDown', x: 0.5, y: 0, button: 0 }));
  events.push(...tracker.input({ _tag: 'PointerMove', x: 0.5, y: 0 }));
  const [turned] = events;
  expect(turned?._tag).toBe('AutoRotated');
  if (turned?._tag !== 'AutoRotated') throw new Error('expected AutoRotated first');
  expect(near(turned.position)).toEqual([-5, 0, 0]);
  // The Model keeps it: the shown camera does not jump.
  camera = autoRotated(camera, turned);
  graph.reconcile(scene({ gestures: 'scene', camera }));
  expect(near(graph.camera.position.toArray())).toEqual([-5, 0, 0]);
  // Pressed, it holds still; released, it turns again.
  graph.tick(10);
  expect(near(graph.camera.position.toArray())).toEqual([-5, 0, 0]);
  tracker.input({ _tag: 'PointerUp', x: 0.5, y: 0, button: 0 });
  graph.tick(17.5);
  expect(near(graph.camera.position.toArray())).toEqual([0, 0, -5]);
  // Kept again, a press right away reports nothing first: it has not turned since.
  const [again] = tracker.input({ _tag: 'PointerDown', x: 0.5, y: 0, button: 0 });
  if (again?._tag !== 'AutoRotated') throw new Error('expected AutoRotated');
  camera = autoRotated(camera, again);
  graph.reconcile(scene({ gestures: 'scene', camera }));
  tracker.input({ _tag: 'PointerUp', x: 0.5, y: 0, button: 0 });
  expect(tracker.input({ _tag: 'PointerDown', x: 0.5, y: 0, button: 0 })).toEqual([]);
  // The orbit after it starts from the kept camera.
  expect(
    near(
      orbit(camera, {
        _tag: 'Drag',
        button: 0,
        modifiers: noModifiers,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        deltaX: 0,
        deltaY: 0,
      }).position,
    ),
  ).toEqual([0, 0, -5]);
  graph.dispose();
});

test('view cameras ease with damping and turn with autoRotate, each on its own', () => {
  const graph = createSceneGraph();
  const views = (left: readonly [number, number, number]) =>
    scene({
      views: [
        view({
          key: 'left',
          camera: perspectiveCamera({ position: left, damping: 0.1 }),
          rect: { width: 0.5 },
        }),
        view({
          key: 'right',
          camera: perspectiveCamera({ position: [0, 0, 5], autoRotate: 2 }),
          rect: { x: 0.5, width: 0.5 },
        }),
      ],
    });
  graph.reconcile(views([0, 0, 5]));
  graph.resize(800, 600);
  const cameraOf = (key: string) => graph.views().find((hosted) => hosted.key === key)?.camera;
  graph.tick(0);
  graph.reconcile(views([5, 0, 0]));
  // Damped: on its way round the target after half a second, not there yet.
  graph.tick(0.5);
  const left = cameraOf('left')?.position;
  expect(left?.length()).toBeCloseTo(5, 6);
  expect(left?.x).toBeGreaterThan(4);
  expect(left?.x).toBeLessThan(5);
  graph.tick(7.5);
  expect(cameraOf('left')?.position.toArray()).toEqual([5, 0, 0]);
  expect(near(cameraOf('right')?.position.toArray() ?? [])).toEqual([-5, 0, 0]);
  expect(near(graph.turned('right') ?? [])).toEqual([-5, 0, 0]);
  expect(graph.turned('left')).toBeUndefined();
  graph.dispose();
});
