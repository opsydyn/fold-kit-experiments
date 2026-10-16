import { expect, test } from 'bun:test';

import { Vector3 } from 'three';

import {
  box,
  createPicker,
  createPointerTracker,
  createSceneGraph,
  type Gesture,
  type Gestures,
  mesh,
  noModifiers,
  orthographicCamera,
  perspectiveCamera,
  type SceneEvent,
  scene,
  standard,
  view,
} from '../src/kernel/index.ts';

const cubeScene = (gestures: Gestures) =>
  scene({
    gestures,
    children: [mesh({ key: 'cube', geometry: box(), material: standard(), interactive: true })],
  });

/** A tracker over an 800 × 600 canvas with an interactive cube in the middle. */
const trackerFor = (gestures: Gestures) => {
  const graph = createSceneGraph();
  graph.reconcile(cubeScene(gestures));
  graph.resize(800, 600);
  return { graph, tracker: createPointerTracker(createPicker(graph)) };
};

const gesturesIn = (events: ReadonlyArray<SceneEvent>): ReadonlyArray<Gesture> =>
  events.flatMap((event) => (event._tag === 'Gesture' ? [event.gesture] : []));

const shift = { ...noModifiers, shift: true };

test('a page-owned canvas reports no gestures', () => {
  const { tracker } = trackerFor('page');
  tracker.input({ _tag: 'PointerDown', x: 0.9, y: 0.9, button: 0 });
  expect(gesturesIn(tracker.input({ _tag: 'PointerMove', x: 0.5, y: 0.9 }))).toEqual([]);
  expect(gesturesIn(tracker.input({ _tag: 'Wheel', x: 0, y: 0, deltaX: 0, deltaY: 100 }))).toEqual(
    [],
  );
});

test('a claimed canvas reports drags in CSS pixels, with the press button and modifiers', () => {
  const { tracker } = trackerFor('scene');
  tracker.input({ _tag: 'PointerDown', x: 0.9, y: 0.9, button: 2, modifiers: shift });
  // 0.1 of NDC across 800 pixels is 40; NDC up is screen up, so down is positive.
  expect(gesturesIn(tracker.input({ _tag: 'PointerMove', x: 0.8, y: 0.8 }))).toEqual([
    {
      _tag: 'Drag',
      button: 2,
      modifiers: shift,
      width: 800,
      height: 600,
      deltaX: expect.closeTo(-40, 9),
      deltaY: expect.closeTo(30, 9),
    },
  ]);
  tracker.input({ _tag: 'PointerUp', x: 0.8, y: 0.8, button: 2 });
  // Released: moving reports nothing until the next press.
  expect(gesturesIn(tracker.input({ _tag: 'PointerMove', x: 0.7, y: 0.8 }))).toEqual([]);
  expect(
    gesturesIn(
      tracker.input({ _tag: 'Wheel', x: 0, y: 0, deltaX: 0, deltaY: -120, modifiers: shift }),
    ),
  ).toEqual([
    { _tag: 'Wheel', modifiers: shift, width: 800, height: 600, deltaX: 0, deltaY: -120 },
  ]);
});

test('a drag that began on a mesh names it, alongside the mesh drag', () => {
  const { tracker } = trackerFor('scene');
  tracker.input({ _tag: 'PointerDown', x: 0, y: 0, button: 0 });
  const events = tracker.input({ _tag: 'PointerMove', x: 0.5, y: 0 });
  expect(events.map((event) => event._tag)).toContain('Drag');
  expect(gesturesIn(events)).toMatchObject([{ _tag: 'Drag', key: 'cube', button: 0 }]);
});

test('a second pointer pinches: the scale of their spread and the midpoint movement', () => {
  const { tracker } = trackerFor('scene');
  tracker.input({ _tag: 'PointerDown', x: -0.5, y: 0.5, button: 0, pointer: 1 });
  // The second finger joins without pressing anything: no button events at all.
  expect(tracker.input({ _tag: 'PointerDown', x: 0.5, y: 0.5, button: 0, pointer: 2 })).toEqual([]);
  // From 400 pixels apart to 600: the second finger moved 200 pixels right.
  expect(gesturesIn(tracker.input({ _tag: 'PointerMove', x: 1, y: 0.5, pointer: 2 }))).toEqual([
    {
      _tag: 'Pinch',
      width: 800,
      height: 600,
      scale: expect.closeTo(1.5, 9),
      deltaX: expect.closeTo(100, 9),
      deltaY: expect.closeTo(0, 9),
    },
  ]);
  // The first finger moving pinches too, rather than dragging.
  expect(
    gesturesIn(tracker.input({ _tag: 'PointerMove', x: -0.5, y: 0.4, pointer: 1 })),
  ).toMatchObject([{ _tag: 'Pinch' }]);
  expect(tracker.input({ _tag: 'PointerUp', x: 1, y: 0.5, button: 0, pointer: 2 })).toEqual([]);
  expect(
    gesturesIn(tracker.input({ _tag: 'PointerMove', x: -0.4, y: 0.4, pointer: 1 })),
  ).toMatchObject([{ _tag: 'Drag' }]);
});

test('with views, a gesture reports the view it began in and that view’s size', () => {
  const graph = createSceneGraph();
  graph.reconcile(
    scene({
      gestures: 'scene',
      views: [
        view({ key: 'left', camera: perspectiveCamera(), rect: { width: 0.5 } }),
        view({ key: 'right', camera: orthographicCamera(), rect: { x: 0.5, width: 0.5 } }),
      ],
    }),
  );
  graph.resize(800, 600);
  const tracker = createPointerTracker(createPicker(graph));
  tracker.input({ _tag: 'PointerDown', x: 0.5, y: 0, button: 0 });
  expect(gesturesIn(tracker.input({ _tag: 'PointerMove', x: -0.5, y: 0 }))).toMatchObject([
    { _tag: 'Drag', view: 'right', width: 400, height: 600, deltaX: -400 },
  ]);
});

test('claiming gestures is no scene operation, and an invalid update keeps the old claim', () => {
  const { graph } = trackerFor('page');
  expect(graph.reconcile(cubeScene('scene'))).toEqual({ _tag: 'Applied', ops: [] });
  expect(graph.gestures()).toBe('scene');
  const twice = mesh({ key: 'x', geometry: box(), material: standard() });
  graph.reconcile(scene({ gestures: 'page', children: [twice, twice] }));
  expect(graph.gestures()).toBe('scene');
});

test('a damped camera eases round its target and lands exactly', () => {
  const graph = createSceneGraph();
  const at = (position: readonly [number, number, number]) =>
    scene({ camera: perspectiveCamera({ position, damping: 0.1 }) });
  graph.reconcile(at([0, 0, 5]));
  expect(graph.camera.position.toArray()).toEqual([0, 0, 5]);

  // A quarter turn: the camera travels round the target, never through it.
  graph.reconcile(at([5, 0, 0]));
  expect(graph.needsFrame()).toBe(true);
  for (let frame = 1; frame <= 30; frame++) {
    graph.tick(frame / 60);
    expect(graph.camera.position.length()).toBeCloseTo(5, 9);
    expect(
      new Vector3(0, 0, -1).applyQuaternion(graph.camera.quaternion).dot(graph.camera.position),
    ).toBeLessThan(0);
  }
  const halfway = graph.camera.position.x;
  expect(halfway).toBeGreaterThan(4);
  expect(halfway).toBeLessThan(5);
  graph.drawn();
  graph.tick(10);
  expect(graph.camera.position.toArray()).toEqual([5, 0, 0]);
  graph.drawn();
  expect(graph.needsFrame()).toBe(false);

  // Frozen (reduced motion), a new aim lands at once.
  graph.setAnimating(false);
  graph.reconcile(at([0, 5, 0.001]));
  expect(graph.camera.position.toArray()).toEqual([0, 5, 0.001]);
  graph.dispose();
});

test('an undamped camera, or a change of camera kind, jumps', () => {
  const graph = createSceneGraph();
  graph.reconcile(scene({ camera: perspectiveCamera({ position: [0, 0, 5] }) }));
  graph.reconcile(scene({ camera: perspectiveCamera({ position: [3, 0, 4] }) }));
  expect(graph.camera.position.toArray()).toEqual([3, 0, 4]);
  graph.reconcile(
    scene({ camera: orthographicCamera({ position: [0, 4, 3], zoom: 40, damping: 0.1 }) }),
  );
  expect(graph.camera.position.toArray()).toEqual([0, 4, 3]);
  expect(graph.camera.zoom).toBe(40);
  graph.dispose();
});
