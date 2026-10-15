import { expect, test } from 'bun:test';

import {
  box,
  createPicker,
  createPointerTracker,
  createSceneGraph,
  mesh,
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
