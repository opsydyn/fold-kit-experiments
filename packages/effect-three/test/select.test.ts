import { expect, test } from 'bun:test';

import {
  box,
  createPicker,
  createSceneGraph,
  createSelectTracker,
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
  return createSelectTracker(createPicker(graph));
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
