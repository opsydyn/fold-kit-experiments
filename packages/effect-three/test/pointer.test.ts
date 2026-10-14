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
  graph.resize(1, 1);
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
