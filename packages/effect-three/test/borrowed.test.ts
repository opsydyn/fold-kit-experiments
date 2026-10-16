import { expect, test } from 'bun:test';

import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Object3D, Texture } from 'three';

import {
  borrowed,
  box,
  createPicker,
  createSceneGraph,
  lambert,
  mesh,
  scene,
  sharedMaterial,
  standard,
} from '../src/kernel/index.ts';

/** The colour map of a hosted mesh's material. */
const materialMap = (object: Object3D | undefined): unknown =>
  object instanceof Mesh ? Reflect.get(object.material, 'map') : 'not a mesh';

/** An application-owned model: a group with a named wheel, positioned by the app itself. */
const model = () => {
  const root = new Group();
  root.position.set(0, 0.5, 0);
  const geometry = new BoxGeometry();
  const wheel = new Mesh(geometry, new MeshBasicMaterial());
  wheel.name = 'wheel';
  root.add(wheel);
  let disposed = 0;
  geometry.addEventListener('dispose', () => {
    disposed++;
  });
  return { root, wheel, disposed: () => disposed };
};

const showing = (id: string, position: readonly [number, number, number] = [0, 0, 0]) =>
  scene({ children: [borrowed({ key: 'car', id, position, interactive: true })] });

test('a lent object is shown as is under a wrapper and never disposed', () => {
  const graph = createSceneGraph();
  const car = model();
  const withdraw = graph.store.lend('car', car.root);
  graph.reconcile(showing('car', [3, 0, 0]));
  const wrapper = graph.object('car');
  expect(car.root.parent).toBe(wrapper ?? null);
  expect(wrapper?.position.toArray()).toEqual([3, 0, 0]);
  // The application's own transform on the object is left alone.
  expect(car.root.position.toArray()).toEqual([0, 0.5, 0]);

  graph.reconcile(scene({}));
  expect(car.root.parent).toBeNull();
  graph.dispose();
  expect(car.disposed()).toBe(0);
  withdraw();
});

test('a node may name an id before it is lent; lending shows it and withdrawing removes it', () => {
  const graph = createSceneGraph();
  graph.reconcile(showing('later'));
  graph.drawn();
  expect(graph.object('car')?.children).toEqual([]);

  const car = model();
  const withdraw = graph.store.lend('later', car.root);
  expect(car.root.parent).toBe(graph.object('car') ?? null);
  expect(graph.needsFrame()).toBe(true);

  graph.drawn();
  withdraw();
  expect(car.root.parent).toBeNull();
  expect(graph.needsFrame()).toBe(true);
  graph.dispose();
});

test('a second node showing the same object gets a clone; an id change swaps objects', () => {
  const graph = createSceneGraph();
  const first = model();
  const second = model();
  graph.store.lend('one', first.root);
  graph.store.lend('two', second.root);
  graph.reconcile(
    scene({
      children: [borrowed({ key: 'a', id: 'one' }), borrowed({ key: 'b', id: 'one' })],
    }),
  );
  const [shownA] = graph.object('a')?.children ?? [];
  const [shownB] = graph.object('b')?.children ?? [];
  expect(shownA).toBe(first.root);
  expect(shownB).not.toBe(first.root);
  expect(shownB?.children[0]).toBeInstanceOf(Mesh);

  graph.reconcile(
    scene({
      children: [borrowed({ key: 'a', id: 'two' }), borrowed({ key: 'b', id: 'one' })],
    }),
  );
  expect(graph.object('a')?.children).toEqual([second.root]);
  graph.dispose();
});

test('a hit inside a borrowed object names the node and the part', () => {
  const graph = createSceneGraph();
  const car = model();
  car.root.position.set(0, 0, 0);
  graph.store.lend('car', car.root);
  graph.reconcile(showing('car'));
  graph.resize(200, 200);
  expect(createPicker(graph).pick(0, 0)).toMatchObject({ key: 'car', part: 'wheel', path: [] });
  graph.dispose();
});

test('a lent texture becomes a material map, owned and shared, and leaves on withdrawal', () => {
  const graph = createSceneGraph();
  graph.reconcile(
    scene({
      resources: { materials: [{ id: 'painted', material: standard({ map: 'bricks' }) }] },
      children: [
        mesh({ key: 'owned', geometry: box(), material: lambert({ map: 'bricks' }) }),
        mesh({ key: 'shared', geometry: box(), material: sharedMaterial('painted') }),
        mesh({ key: 'plain', geometry: box(), material: lambert() }),
      ],
    }),
  );
  const mapOf = (key: string): unknown => materialMap(graph.object(key));
  expect(mapOf('owned')).toBeNull();

  const bricks = new Texture();
  let disposed = false;
  bricks.addEventListener('dispose', () => {
    disposed = true;
  });
  const owned = graph.object('owned');
  const version = owned instanceof Mesh ? owned.material.version : -1;
  const withdraw = graph.store.lendTexture('bricks', bricks);
  expect(mapOf('owned')).toBe(bricks);
  expect(mapOf('shared')).toBe(bricks);
  expect(mapOf('plain')).toBeNull();
  // Gaining a map changes the shader, so the material recompiles.
  expect(owned instanceof Mesh && owned.material.version > version).toBe(true);

  withdraw();
  expect(mapOf('owned')).toBeNull();
  expect(mapOf('shared')).toBeNull();
  graph.dispose();
  expect(disposed).toBe(false);
});
