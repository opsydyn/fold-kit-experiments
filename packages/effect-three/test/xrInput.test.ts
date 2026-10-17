import { expect, test } from 'bun:test';

import {
  box,
  createPicker,
  createSceneGraph,
  createXrTracker,
  mesh,
  type Ray,
  scene,
  standard,
} from '../src/kernel/index.ts';

const setup = () => {
  const graph = createSceneGraph();
  graph.reconcile(
    scene({
      children: [
        mesh({ key: 'cube', geometry: box(), material: standard(), interactive: true }),
        mesh({ key: 'inert', position: [3, 0, 0], geometry: box(), material: standard() }),
      ],
    }),
  );
  return createXrTracker(createPicker(graph));
};

const at = (x: number): Ray => ({ origin: [x, 0, 5], direction: [0, 0, -1] });
const onCube = at(0);
const offCube = at(6);
const tags = (events: ReadonlyArray<{ readonly _tag: string }>) => events.map(({ _tag }) => _tag);

test('a controller select on a mesh is its pointer down, up and click, hit along the ray', () => {
  const select = setup();
  const down = select({ _tag: 'SelectStart', source: 0, ray: onCube });
  expect(down).toMatchObject([{ _tag: 'PointerDown', key: 'cube', button: 0, point: [0, 0, 0.5] }]);
  expect(tags(select({ _tag: 'SelectEnd', source: 0, ray: onCube }))).toEqual([
    'PointerUp',
    'Click',
  ]);
});

test('ending elsewhere is no click; selecting nothing is a miss; controllers are apart', () => {
  const select = setup();
  select({ _tag: 'SelectStart', source: 0, ray: onCube });
  expect(select({ _tag: 'SelectEnd', source: 0, ray: offCube })).toEqual([]);

  select({ _tag: 'SelectStart', source: 1, ray: offCube });
  expect(select({ _tag: 'SelectEnd', source: 1, ray: offCube })).toEqual([
    { _tag: 'PointerMissed', button: 0 },
  ]);

  // The left hand starts on the cube while the right starts off it: each ends its own.
  select({ _tag: 'SelectStart', source: 0, ray: onCube });
  select({ _tag: 'SelectStart', source: 1, ray: offCube });
  expect(tags(select({ _tag: 'SelectEnd', source: 1, ray: onCube }))).toEqual(['PointerUp']);
  expect(tags(select({ _tag: 'SelectEnd', source: 0, ray: onCube }))).toEqual([
    'PointerUp',
    'Click',
  ]);
  // Non-interactive meshes are not hit.
  expect(select({ _tag: 'SelectStart', source: 2, ray: at(3) })).toEqual([]);
});

test('aiming enters and leaves what each source points at', () => {
  const input = setup();
  expect(input({ _tag: 'Aim', source: 0, ray: offCube })).toEqual([]);
  expect(input({ _tag: 'Aim', source: 0, ray: onCube })).toMatchObject([
    { _tag: 'PointerEnter', key: 'cube' },
  ]);
  // Still on it: nothing. Another source pointing at it enters it for itself.
  expect(input({ _tag: 'Aim', source: 0, ray: at(0.1) })).toEqual([]);
  expect(tags(input({ _tag: 'Aim', source: 1, ray: onCube }))).toEqual(['PointerEnter']);
  expect(input({ _tag: 'Aim', source: 0, ray: offCube })).toEqual([
    { _tag: 'PointerLeave', key: 'cube' },
  ]);
  // A source put down leaves what it pointed at.
  expect(input({ _tag: 'Lost', source: 1 })).toEqual([{ _tag: 'PointerLeave', key: 'cube' }]);
});

test('a select held on a mesh drags it as the source moves, wherever it points', () => {
  const input = setup();
  input({ _tag: 'Aim', source: 0, ray: onCube });
  input({ _tag: 'SelectStart', source: 0, ray: onCube });
  // Moving off the cube still drags it, and leaves it.
  expect(input({ _tag: 'Aim', source: 0, ray: offCube })).toEqual([
    { _tag: 'Drag', key: 'cube', button: 0, ray: offCube },
    { _tag: 'PointerLeave', key: 'cube' },
  ]);
  expect(input({ _tag: 'SelectEnd', source: 0, ray: offCube })).toEqual([
    { _tag: 'DragEnd', key: 'cube', button: 0, ray: offCube },
  ]);
  // A drag cut short by the source going ends where it last aimed.
  input({ _tag: 'SelectStart', source: 0, ray: onCube });
  input({ _tag: 'Aim', source: 0, ray: at(0.2) });
  expect(input({ _tag: 'Lost', source: 0 })).toMatchObject([
    { _tag: 'DragEnd', key: 'cube', ray: at(0.2) },
    { _tag: 'PointerLeave', key: 'cube' },
  ]);
});

test('holding still is not dragging: a select that barely moves is a click', () => {
  const input = setup();
  input({ _tag: 'SelectStart', source: 0, ray: onCube });
  // Half a millimetre of jitter: it points at the cube, but drags nothing.
  expect(tags(input({ _tag: 'Aim', source: 0, ray: at(0.0005) }))).toEqual(['PointerEnter']);
  expect(tags(input({ _tag: 'SelectEnd', source: 0, ray: onCube }))).toEqual([
    'PointerUp',
    'Click',
  ]);
});

test('sticks, buttons and surfaces become XR events', () => {
  const input = setup();
  expect(input({ _tag: 'Stick', source: 0, hand: 'right', direction: 'left' })).toEqual([
    { _tag: 'XrStick', hand: 'right', direction: 'left' },
  ]);
  expect(
    input({ _tag: 'Button', source: 0, hand: 'left', button: 'squeeze', pressed: true }),
  ).toEqual([{ _tag: 'XrButton', hand: 'left', button: 'squeeze', pressed: true }]);
  expect(
    input({ _tag: 'Surface', source: 0, hand: 'right', point: [1, 0, -2], normal: [0, 1, 0] }),
  ).toEqual([{ _tag: 'XrSurface', hand: 'right', point: [1, 0, -2], normal: [0, 1, 0] }]);
});
