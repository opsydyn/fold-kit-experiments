import { expect, test } from 'bun:test';

import {
  box,
  createPicker,
  createPointerTracker,
  createSceneGraph,
  group,
  mesh,
  pointOnPlane,
  scene,
  standard,
} from '../src/kernel/index.ts';

const trackerOverCube = () => {
  const graph = createSceneGraph();
  graph.reconcile(
    scene({
      children: [
        mesh({ key: 'cube', geometry: box(), material: standard({ color: 0 }), interactive: true }),
        mesh({
          key: 'inert',
          geometry: box(),
          material: standard({ color: 0 }),
          position: [3, 0, 0],
        }),
      ],
    }),
  );
  graph.resize(200, 200);
  return createPointerTracker(createPicker(graph));
};

const tags = (events: ReadonlyArray<{ readonly _tag: string }>) =>
  events.map((event) => event._tag);

test('releasing off the pressed object cancels the click', () => {
  const tracker = trackerOverCube();
  expect(tags(tracker.input({ _tag: 'PointerDown', x: 0, y: 0, button: 0 }))).toEqual([
    'PointerEnter',
    'PointerDown',
  ]);
  expect(tags(tracker.input({ _tag: 'PointerUp', x: 0.95, y: 0.95, button: 0 }))).toEqual([
    'PointerLeave',
  ]);
  expect(tags(tracker.input({ _tag: 'PointerUp', x: 0, y: 0, button: 0 }))).toEqual([
    'PointerEnter',
    'PointerUp',
  ]);
});

test('a different button does not complete a click', () => {
  const tracker = trackerOverCube();
  tracker.input({ _tag: 'PointerDown', x: 0, y: 0, button: 0 });
  expect(tags(tracker.input({ _tag: 'PointerUp', x: 0, y: 0, button: 2 }))).toEqual(['PointerUp']);
});

test('non-interactive meshes are not hit', () => {
  const tracker = trackerOverCube();
  expect(tracker.input({ _tag: 'PointerMove', x: 0.6, y: 0 })).toEqual([]);
  expect(tracker.frame()).toEqual([]);
});

test('leaving the surface clears hover and press state', () => {
  const tracker = trackerOverCube();
  tracker.input({ _tag: 'PointerDown', x: 0, y: 0, button: 0 });
  expect(tracker.input({ _tag: 'PointerLeave' })).toEqual([{ _tag: 'PointerLeave', key: 'cube' }]);
  expect(tracker.frame()).toEqual([]);
  expect(tags(tracker.input({ _tag: 'PointerUp', x: 0, y: 0, button: 0 }))).toEqual([
    'PointerEnter',
    'PointerUp',
  ]);
});

test('moving over a mesh emits a move with the full hit', () => {
  const tracker = trackerOverCube();
  const [enter, move] = tracker.input({ _tag: 'PointerMove', x: 0, y: 0 });
  expect(enter?._tag).toBe('PointerEnter');
  expect(move).toMatchObject({ _tag: 'PointerMove', key: 'cube' });
  if (move?._tag !== 'PointerMove') throw new Error('expected a move');
  expect(move.distance).toBeGreaterThan(0);
  expect(move.normal[0]).toBeCloseTo(0, 9);
  expect(move.normal[1]).toBeCloseTo(0, 9);
  expect(move.normal[2]).toBeCloseTo(1, 9);
  expect(move.uv[0]).toBeCloseTo(0.5, 9);
  expect(move.uv[1]).toBeCloseTo(0.5, 9);
  expect(tags(tracker.input({ _tag: 'PointerMove', x: 0.01, y: 0 }))).toEqual(['PointerMove']);
  expect(tracker.frame()).toEqual([]);
});

test('a click on nothing is a miss unless the pointer travelled more than two pixels', () => {
  const tracker = trackerOverCube();
  // The viewport is 200 px wide, so 0.01 NDC is one pixel.
  tracker.input({ _tag: 'PointerDown', x: 0.9, y: 0.9, button: 0 });
  expect(tracker.input({ _tag: 'PointerUp', x: 0.91, y: 0.9, button: 0 })).toEqual([
    { _tag: 'PointerMissed', button: 0 },
  ]);
  tracker.input({ _tag: 'PointerDown', x: 0.9, y: 0.9, button: 2 });
  expect(tracker.input({ _tag: 'PointerUp', x: 0.95, y: 0.9, button: 2 })).toEqual([]);
  tracker.input({ _tag: 'PointerDown', x: 0.9, y: 0.9, button: 0 });
  expect(tracker.input({ _tag: 'PointerUp', x: 0.9, y: 0.9, button: 1 })).toEqual([]);
  expect(tracker.input({ _tag: 'PointerUp', x: 0.9, y: 0.9, button: 0 })).toEqual([]);
});

/** A press by `device` lifted `pixels` to the right, on nothing (0.01 NDC is one pixel). */
function pressAndLift(
  tracker: ReturnType<typeof trackerOverCube>,
  device: 'mouse' | 'pen' | 'touch',
  pixels: number,
) {
  tracker.input({ _tag: 'PointerDown', x: 0.8, y: 0.8, button: 0, device });
  return tracker.input({ _tag: 'PointerUp', x: 0.8 + pixels * 0.01, y: 0.8, button: 0 });
}

test('a finger may wander further than a mouse and still miss; a pen is held to the mouse’s', () => {
  const tracker = trackerOverCube();
  // The viewport is 200 px wide, so 0.01 NDC is one pixel.
  expect(pressAndLift(tracker, 'touch', 6)).toEqual([{ _tag: 'PointerMissed', button: 0 }]);
  expect(pressAndLift(tracker, 'touch', 10)).toEqual([{ _tag: 'PointerMissed', button: 0 }]);
  expect(pressAndLift(tracker, 'touch', 12)).toEqual([]);
  expect(pressAndLift(tracker, 'mouse', 6)).toEqual([]);
  expect(pressAndLift(tracker, 'pen', 6)).toEqual([]);
  // A press that names no device is a mouse's.
  tracker.input({ _tag: 'PointerDown', x: 0.8, y: 0.8, button: 0 });
  expect(tracker.input({ _tag: 'PointerUp', x: 0.86, y: 0.8, button: 0 })).toEqual([]);
});

test('double-click and context menu go only to the mesh that was pressed', () => {
  const tracker = trackerOverCube();
  tracker.input({ _tag: 'PointerDown', x: 0, y: 0, button: 0 });
  tracker.input({ _tag: 'PointerUp', x: 0, y: 0, button: 0 });
  expect(tags(tracker.input({ _tag: 'DoubleClick', x: 0, y: 0, button: 0 }))).toEqual([
    'DoubleClick',
  ]);
  expect(tags(tracker.input({ _tag: 'ContextMenu', x: 0, y: 0 }))).toEqual(['ContextMenu']);

  tracker.input({ _tag: 'PointerDown', x: 0.9, y: 0.9, button: 0 });
  expect(tags(tracker.input({ _tag: 'DoubleClick', x: 0, y: 0, button: 0 }))).toEqual([
    'PointerEnter',
  ]);
  expect(tracker.input({ _tag: 'ContextMenu', x: 0, y: 0 })).toEqual([]);
});

test('wheel events report their deltas over a mesh and nothing elsewhere', () => {
  const tracker = trackerOverCube();
  const events = tracker.input({ _tag: 'Wheel', x: 0, y: 0, deltaX: 0, deltaY: -120 });
  expect(events[1]).toMatchObject({ _tag: 'Wheel', key: 'cube', deltaX: 0, deltaY: -120 });
  expect(tags(tracker.input({ _tag: 'Wheel', x: 0.9, y: 0.9, deltaX: 0, deltaY: 40 }))).toEqual([
    'PointerLeave',
  ]);
});

test('an interactive group makes its meshes pickable and every hit names its ancestors', () => {
  const graph = createSceneGraph();
  graph.reconcile(
    scene({
      children: [
        group({
          key: 'robot',
          interactive: true,
          children: [
            group({
              key: 'arm',
              children: [mesh({ key: 'hand', geometry: box(), material: standard({ color: 0 }) })],
            }),
          ],
        }),
      ],
    }),
  );
  graph.resize(200, 200);
  const picker = createPicker(graph);
  expect(picker.pick(0, 0)).toMatchObject({ key: 'hand', path: ['arm', 'robot'] });

  graph.reconcile(
    scene({
      children: [
        group({
          key: 'robot',
          children: [
            group({
              key: 'arm',
              children: [mesh({ key: 'hand', geometry: box(), material: standard({ color: 0 }) })],
            }),
          ],
        }),
      ],
    }),
  );
  expect(picker.pick(0, 0)).toBeUndefined();
  graph.dispose();
});

test('pressing a mesh captures the pointer: drags follow it anywhere until release', () => {
  const tracker = trackerOverCube();
  tracker.input({ _tag: 'PointerDown', x: 0, y: 0, button: 0 });
  const offCube = tracker.input({ _tag: 'PointerMove', x: 0.9, y: 0.9 });
  expect(tags(offCube)).toEqual(['PointerLeave', 'Drag']);
  const drag = offCube[1];
  if (drag?._tag !== 'Drag') throw new Error('expected a drag');
  expect(drag).toMatchObject({ key: 'cube', button: 0 });
  // The default camera sits at z = 5 looking down -z.
  expect(drag.ray.origin[2]).toBeCloseTo(5, 9);
  expect(drag.ray.direction[2]).toBeLessThan(0);
  expect(Math.hypot(...drag.ray.direction)).toBeCloseTo(1, 9);

  expect(tags(tracker.input({ _tag: 'PointerUp', x: 0.9, y: 0.9, button: 0 }))).toEqual([
    'DragEnd',
  ]);
  expect(tags(tracker.input({ _tag: 'PointerMove', x: 0.9, y: 0.8 }))).toEqual([]);
});

test('a press on nothing captures nothing, leaving mid-drag ends it, and clicks are not drags', () => {
  const tracker = trackerOverCube();
  tracker.input({ _tag: 'PointerDown', x: 0.9, y: 0.9, button: 0 });
  expect(tags(tracker.input({ _tag: 'PointerMove', x: 0.5, y: 0.9 }))).toEqual([]);
  tracker.input({ _tag: 'PointerUp', x: 0.5, y: 0.9, button: 0 });

  tracker.input({ _tag: 'PointerDown', x: 0, y: 0, button: 2 });
  tracker.input({ _tag: 'PointerMove', x: 0.05, y: 0 });
  expect(tags(tracker.input({ _tag: 'PointerLeave' }))).toEqual(['DragEnd', 'PointerLeave']);
  // A press released without moving was a click: no drag to end.
  tracker.input({ _tag: 'PointerDown', x: 0, y: 0, button: 0 });
  expect(tags(tracker.input({ _tag: 'PointerUp', x: 0, y: 0, button: 0 }))).toEqual([
    'PointerUp',
    'Click',
  ]);
});

test('pointOnPlane intersects drag rays with a plane', () => {
  const down = { origin: [0, 5, 0], direction: [0, -1, 0] } as const;
  expect(pointOnPlane(down, { normal: [0, 1, 0], constant: 0 })).toEqual([0, 0, 0]);
  expect(pointOnPlane(down, { normal: [0, 1, 0], constant: -2 })).toEqual([0, 2, 0]);
  expect(pointOnPlane(down, { normal: [1, 0, 0], constant: 0 })).toBeUndefined();
  expect(pointOnPlane(down, { normal: [0, 1, 0], constant: -6 })).toBeUndefined();
});
