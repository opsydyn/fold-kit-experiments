import { describe, expect, test } from 'bun:test';

import { type BufferGeometry, type Material, Mesh } from 'three';

import {
  ambientLight,
  box,
  createPicker,
  createResourceStore,
  createSceneGraph,
  directionalLight,
  group,
  mesh,
  type Op,
  orthographicCamera,
  perspectiveCamera,
  scene,
  sharedGeometry,
  sharedMaterial,
  spin,
  standard,
} from '../src/kernel/index.ts';
import { snapshot } from './support/snapshot.ts';

const cube = (key: string, color = 0x3366ff) =>
  mesh({ key, geometry: box(), material: standard({ color }), interactive: true });

const sharedResources = {
  geometries: [{ id: 'cube', geometry: box({ width: 2 }) }],
  materials: [{ id: 'blue', material: standard({ color: 0x0000ff }) }],
};

const sharedCube = (key: string) =>
  mesh({ key, geometry: sharedGeometry('cube'), material: sharedMaterial('blue') });

/** The geometry and material of a hosted mesh. */
const resourcesOf = (graph: ReturnType<typeof createSceneGraph>, key: string) => {
  const object = graph.object(key);
  if (!(object instanceof Mesh)) throw new Error(`"${key}" is not a hosted mesh`);
  const geometry: BufferGeometry = object.geometry;
  const material: Material = object.material;
  return { geometry, material };
};

const tags = (ops: ReadonlyArray<Op>): ReadonlyArray<string> => ops.map((op) => op._tag);

const applied = (result: ReturnType<ReturnType<typeof createSceneGraph>['reconcile']>) => {
  if (result._tag !== 'Applied') throw new Error(`expected Applied, got ${result.error._tag}`);
  return result.ops;
};

/** Counts how many times each resource fires three's `dispose` event. */
const disposeCounter = () => {
  const counts = new Map<BufferGeometry | Material, number>();
  return {
    watch: (resource: BufferGeometry | Material) => {
      if (counts.has(resource)) return;
      counts.set(resource, 0);
      resource.addEventListener('dispose', () => {
        counts.set(resource, (counts.get(resource) ?? 0) + 1);
      });
    },
    count: (resource: BufferGeometry | Material) => counts.get(resource) ?? 0,
  };
};

describe('reconcile', () => {
  test('first reconcile creates nodes in order', () => {
    const graph = createSceneGraph();
    const ops = applied(
      graph.reconcile(
        scene({
          children: [ambientLight({ key: 'ambient' }), directionalLight({ key: 'sun' }), cube('a')],
        }),
      ),
    );
    expect(tags(ops)).toEqual([
      'SetCamera',
      'SetViews',
      'SetRenderSettings',
      'DefineResources',
      'Create',
      'Create',
      'Create',
    ]);
    expect(graph.scene.children.map((child) => graph.keyOf(child))).toEqual([
      'ambient',
      'sun',
      'a',
    ]);
  });

  test('a model change updates the existing mesh and its owned material in place', () => {
    const graph = createSceneGraph();
    graph.reconcile(scene({ children: [cube('a', 0xff0000)] }));
    const before = graph.object('a');
    const materialBefore = graph.store.stats().materials;
    const ops = applied(graph.reconcile(scene({ children: [cube('a', 0x0000ff)] })));
    expect(ops).toEqual([{ _tag: 'Update', node: cube('a', 0x0000ff), fields: ['material'] }]);
    const after = graph.object('a');
    expect(after).toBe(before);
    expect(after?.uuid).toBe(before?.uuid);
    expect(graph.store.stats().materials).toEqual(materialBefore);
    expect(snapshot(graph)).toMatchObject({
      children: [{ detail: { material: { color: 0x0000ff } } }],
    });
  });

  test('a structurally equal description produces no ops', () => {
    const graph = createSceneGraph();
    graph.reconcile(scene({ children: [cube('a'), group({ key: 'g', children: [cube('b')] })] }));
    const ops = applied(
      graph.reconcile(scene({ children: [cube('a'), group({ key: 'g', children: [cube('b')] })] })),
    );
    expect(ops).toEqual([]);
  });

  test('moving a node between parents keeps its identity', () => {
    const graph = createSceneGraph();
    graph.reconcile(
      scene({ children: [group({ key: 'left', children: [cube('a')] }), group({ key: 'right' })] }),
    );
    const before = graph.object('a');
    const ops = applied(
      graph.reconcile(
        scene({
          children: [group({ key: 'left' }), group({ key: 'right', children: [cube('a')] })],
        }),
      ),
    );
    expect(tags(ops)).toEqual(['Move']);
    expect(graph.object('a')).toBe(before);
    expect(graph.object('a')?.parent).toBe(graph.object('right'));
  });

  test('reordering siblings emits one Order op and keeps identities', () => {
    const graph = createSceneGraph();
    graph.reconcile(scene({ children: [cube('a'), cube('b'), cube('c')] }));
    const objects = ['a', 'b', 'c'].map((key) => graph.object(key));
    const ops = applied(graph.reconcile(scene({ children: [cube('c'), cube('a'), cube('b')] })));
    expect(ops).toEqual([{ _tag: 'Order', parent: null, keys: ['c', 'a', 'b'] }]);
    expect(graph.scene.children.map((child) => objects.indexOf(child))).toEqual([2, 0, 1]);
  });

  test('changing kind under a key replaces it in place and keeps its children', () => {
    const graph = createSceneGraph();
    graph.reconcile(
      scene({
        children: [cube('first'), group({ key: 'x', children: [cube('child')] }), cube('last')],
      }),
    );
    const child = graph.object('child');
    const oldX = graph.object('x');
    const ops = applied(
      graph.reconcile(
        scene({
          children: [
            cube('first'),
            mesh({ key: 'x', geometry: box(), material: standard({ color: 1 }) }),
            cube('last'),
            cube('child'),
          ],
        }),
      ),
    );
    expect(tags(ops)).toEqual(['Replace', 'Move']);
    expect(graph.object('x')).not.toBe(oldX);
    expect(graph.object('child')).toBe(child);
    expect(graph.scene.children.map((object) => graph.keyOf(object))).toEqual([
      'first',
      'x',
      'last',
      'child',
    ]);
  });

  test('an invalid description is rejected atomically', () => {
    const graph = createSceneGraph();
    graph.reconcile(scene({ children: [cube('a')] }));
    const before = snapshot(graph);
    const stats = graph.store.stats();
    const result = graph.reconcile(scene({ children: [cube('b'), cube('b')] }));
    expect(result).toEqual({ _tag: 'Invalid', error: { _tag: 'DuplicateKey', key: 'b' } });
    expect(snapshot(graph)).toEqual(before);
    expect(graph.store.stats()).toEqual(stats);
    expect(
      graph.reconcile(
        scene({
          children: [
            mesh({ key: 'm', geometry: sharedGeometry('nope'), material: standard({ color: 0 }) }),
          ],
        }),
      ),
    ).toEqual({
      _tag: 'Invalid',
      error: { _tag: 'UnknownSharedGeometry', nodeKey: 'm', id: 'nope' },
    });
  });

  test('resource definitions are validated', () => {
    const graph = createSceneGraph();
    const geometry = { id: 'g', geometry: box() };
    const material = { id: 'm', material: standard({ color: 0 }) };
    expect(graph.reconcile(scene({ resources: { geometries: [geometry, geometry] } }))).toEqual({
      _tag: 'Invalid',
      error: { _tag: 'DuplicateResourceId', resource: 'geometry', id: 'g' },
    });
    expect(graph.reconcile(scene({ resources: { materials: [material, material] } }))).toEqual({
      _tag: 'Invalid',
      error: { _tag: 'DuplicateResourceId', resource: 'material', id: 'm' },
    });
    const orphan = mesh({ key: 'n', geometry: box(), material: sharedMaterial('missing') });
    expect(graph.reconcile(scene({ children: [orphan] }))).toEqual({
      _tag: 'Invalid',
      error: { _tag: 'UnknownSharedMaterial', nodeKey: 'n', id: 'missing' },
    });
  });

  test('camera changes update the same camera object', () => {
    const graph = createSceneGraph();
    graph.reconcile(scene({}));
    const camera = graph.camera;
    const ops = applied(graph.reconcile(scene({ camera: perspectiveCamera({ fov: 70 }) })));
    expect(tags(ops)).toEqual(['SetCamera']);
    expect(graph.camera).toBe(camera);
    expect(graph.camera).toMatchObject({ type: 'PerspectiveCamera', fov: 70 });
  });

  test('switching camera kind replaces the camera and fits it to the viewport', () => {
    const graph = createSceneGraph();
    graph.reconcile(scene({}));
    graph.resize(800, 400);
    const perspective = graph.camera;
    expect(perspective).toMatchObject({ aspect: 2 });

    graph.reconcile(scene({ camera: orthographicCamera({ zoom: 50 }) }));
    expect(graph.camera).not.toBe(perspective);
    // As in React Three Fiber: the frustum spans the viewport in CSS pixels, scaled by zoom.
    expect(graph.camera).toMatchObject({
      type: 'OrthographicCamera',
      zoom: 50,
      left: -400,
      right: 400,
      top: 200,
      bottom: -200,
    });

    graph.resize(1000, 600);
    expect(graph.camera).toMatchObject({ left: -500, right: 500, top: 300, bottom: -300 });
    const orthographic = graph.camera;
    graph.reconcile(scene({ camera: orthographicCamera({ zoom: 80 }) }));
    expect(graph.camera).toBe(orthographic);

    graph.reconcile(scene({}));
    expect(graph.camera).toMatchObject({ type: 'PerspectiveCamera', aspect: 1000 / 600 });
  });

  test('picking works through an orthographic camera', () => {
    const graph = createSceneGraph();
    graph.reconcile(
      scene({
        camera: orthographicCamera({ zoom: 100 }),
        children: [cube('a'), mesh({ ...cube('b'), key: 'b', position: [3, 0, 0] })],
      }),
    );
    graph.resize(1000, 500);
    const picker = createPicker(graph);
    expect(picker.pick(0, 0)?.key).toBe('a');
    // 3 world units right at 100 px per unit is 300 px of a 500 px half-width: x = 0.6.
    expect(picker.pick(0.6, 0)?.key).toBe('b');
    expect(picker.pick(0.3, 0)).toBeUndefined();
  });
});

describe('resources', () => {
  test('shared resources survive until their final owner releases them', () => {
    const graph = createSceneGraph();
    const counter = disposeCounter();
    graph.reconcile(
      scene({ resources: sharedResources, children: [sharedCube('a'), sharedCube('b')] }),
    );
    const shared = resourcesOf(graph, 'a');
    expect(resourcesOf(graph, 'b')).toEqual(shared);
    counter.watch(shared.geometry);
    counter.watch(shared.material);
    const geometry = graph.store.stats();
    expect(geometry.geometries.live).toBe(1);
    expect(geometry.sharedGeometryUsers.get('cube')).toBe(2);

    graph.reconcile(scene({ resources: sharedResources, children: [sharedCube('b')] }));
    expect(counter.count(shared.geometry)).toBe(0);
    expect(graph.store.stats().geometries.live).toBe(1);
    expect(graph.store.stats().sharedGeometryUsers.get('cube')).toBe(1);

    graph.reconcile(scene({ resources: sharedResources, children: [] }));
    expect(graph.store.stats().geometries).toEqual({ created: 1, disposed: 1, live: 0 });
    expect(graph.store.stats().materials).toEqual({ created: 1, disposed: 1, live: 0 });
    expect(counter.count(shared.geometry)).toBe(1);
    expect(counter.count(shared.material)).toBe(1);
  });

  test('one store shares resources across scene graphs', () => {
    const store = createResourceStore();
    const left = createSceneGraph({ store });
    const right = createSceneGraph({ store });
    left.reconcile(scene({ resources: sharedResources, children: [sharedCube('a')] }));
    right.reconcile(scene({ resources: sharedResources, children: [sharedCube('a')] }));
    expect(store.stats().geometries.live).toBe(1);
    left.dispose();
    expect(store.stats().geometries.live).toBe(1);
    right.dispose();
    expect(store.stats().geometries).toEqual({ created: 1, disposed: 1, live: 0 });
    store.dispose();
    expect(store.stats().geometries.disposed).toBe(1);
  });

  test('changing a live shared geometry swaps it onto every user and disposes the old one once', () => {
    const graph = createSceneGraph();
    const counter = disposeCounter();
    graph.reconcile(
      scene({ resources: sharedResources, children: [sharedCube('a'), sharedCube('b')] }),
    );
    const original = resourcesOf(graph, 'a').geometry;
    counter.watch(original);
    const next = {
      geometries: [{ id: 'cube', geometry: box({ width: 3 }) }],
      materials: sharedResources.materials,
    };
    const ops = applied(
      graph.reconcile(scene({ resources: next, children: [sharedCube('a'), sharedCube('b')] })),
    );
    expect(tags(ops)).toEqual(['DefineResources']);
    expect(resourcesOf(graph, 'a').geometry).toBe(resourcesOf(graph, 'b').geometry);
    expect(resourcesOf(graph, 'a').geometry).not.toBe(original);
    expect(counter.count(original)).toBe(1);
    expect(graph.store.stats().geometries.live).toBe(1);
  });

  test('dispose releases every owned resource exactly once', () => {
    const graph = createSceneGraph();
    const counter = disposeCounter();
    graph.reconcile(
      scene({
        resources: sharedResources,
        children: [cube('a'), group({ key: 'g', children: [cube('b'), sharedCube('c')] })],
      }),
    );
    const all = ['a', 'b', 'c'].flatMap((key) => Object.values(resourcesOf(graph, key)));
    for (const resource of all) counter.watch(resource);
    graph.dispose();
    for (const resource of all) expect(counter.count(resource)).toBe(1);
    const stats = graph.store.stats();
    expect(stats.geometries.live).toBe(0);
    expect(stats.materials.live).toBe(0);
    expect(stats.geometries.disposed).toBe(stats.geometries.created);
    expect(graph.scene.children).toEqual([]);
  });
});

describe('behaviours', () => {
  test('spin is a pure function of elapsed time and needs no reconcile', () => {
    const graph = createSceneGraph();
    graph.reconcile(
      scene({
        children: [
          mesh({
            key: 'a',
            geometry: box(),
            material: standard({ color: 0 }),
            rotation: spin({ axis: 'y', radiansPerSecond: 2, phase: 0.5 }),
          }),
        ],
      }),
    );
    const object = graph.object('a');
    expect(object?.rotation.y).toBe(0.5);
    for (let frame = 1; frame <= 600; frame++) graph.tick(frame / 60);
    expect(object?.rotation.y).toBe(0.5 + 2 * (600 / 60));
    expect([object?.rotation.x, object?.rotation.z]).toEqual([0, 0]);
  });

  test('switching from spin to fixed stops the behaviour', () => {
    const graph = createSceneGraph();
    const spinning = mesh({
      key: 'a',
      geometry: box(),
      material: standard({ color: 0 }),
      rotation: spin({ axis: 'x', radiansPerSecond: 1 }),
    });
    graph.reconcile(scene({ children: [spinning] }));
    graph.tick(1);
    graph.reconcile(
      scene({ children: [{ ...spinning, rotation: { _tag: 'Fixed', euler: [0, 0, 0.25] } }] }),
    );
    graph.tick(5);
    const object = graph.object('a');
    expect([object?.rotation.x, object?.rotation.y, object?.rotation.z]).toEqual([0, 0, 0.25]);
  });
});
