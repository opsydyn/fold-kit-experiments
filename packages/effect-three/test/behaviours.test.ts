import { expect, test } from 'bun:test';

import {
  type Behaviour,
  behave,
  box,
  createSceneGraph,
  ease,
  fixed,
  mesh,
  scene,
  standard,
  type Vec3,
} from '../src/kernel/index.ts';

const cube = (options: {
  readonly position?: Vec3;
  readonly behaviour?: ReturnType<typeof behave> | null;
  readonly eased?: boolean;
}) =>
  scene({
    children: [
      mesh({
        key: 'a',
        geometry: box(),
        material: standard(),
        position: options.position ?? [1, 2, 3],
        rotation: fixed([0, 0.5, 0]),
        behaviour: options.behaviour ?? null,
        ...(options.eased === true ? { transition: ease({ seconds: 1, easing: 'linear' }) } : {}),
      }),
    ],
  });

const pose = (graph: ReturnType<typeof createSceneGraph>) => {
  const object = graph.object('a');
  return {
    position: object?.position.toArray() ?? [],
    rotation: [object?.rotation.x ?? 0, object?.rotation.y ?? 0, object?.rotation.z ?? 0],
  };
};

test('float sways and bobs as Drei does, on top of the node transform, and rewinds', () => {
  const graph = createSceneGraph();
  graph.reconcile(cube({ behaviour: behave('float', { speed: 2, floatIntensity: 3 }) }));
  graph.tick(1.5);
  const angle = (1.5 / 4) * 2;
  const { position, rotation } = pose(graph);
  expect(position[0]).toBe(1);
  expect(position[1]).toBeCloseTo(2 + (Math.sin(angle) / 10) * 3, 9);
  expect(position[2]).toBe(3);
  expect(rotation[0]).toBeCloseTo(Math.cos(angle) / 8, 9);
  expect(rotation[1]).toBeCloseTo(0.5 + Math.sin(angle) / 8, 9);
  expect(rotation[2]).toBeCloseTo(Math.sin(angle) / 20, 9);

  graph.tick(4);
  graph.tick(1.5);
  expect(pose(graph)).toEqual({ position, rotation });
  graph.dispose();
});

test('registered behaviours apply by name; unknown names are rejected', () => {
  const orbit: Behaviour = (out, seconds, params) => {
    const radius = params['radius'] ?? 1;
    out.offset.set(Math.cos(seconds) * radius, 0, Math.sin(seconds) * radius);
    out.scale.setScalar(params['grow'] ?? 1);
  };
  const graph = createSceneGraph({ behaviours: { orbit } });
  graph.reconcile(
    cube({ position: [0, 0, 0], behaviour: behave('orbit', { radius: 2, grow: 3 }) }),
  );
  graph.tick(Math.PI / 2);
  const object = graph.object('a');
  expect(object?.position.x).toBeCloseTo(0, 9);
  expect(object?.position.z).toBeCloseTo(2, 9);
  expect(object?.scale.toArray()).toEqual([3, 3, 3]);

  expect(graph.reconcile(cube({ behaviour: behave('wobble') }))).toEqual({
    _tag: 'Invalid',
    error: { _tag: 'UnknownBehaviour', nodeKey: 'a', name: 'wobble' },
  });
  graph.dispose();
});

test('an eased move on a behaving node starts from the pose on screen', () => {
  const graph = createSceneGraph();
  const floating = behave('float');
  graph.reconcile(cube({ behaviour: floating, eased: true }));
  graph.tick(2);
  const before = pose(graph).position;
  graph.reconcile(cube({ position: [5, 2, 3], behaviour: floating, eased: true }));
  graph.tick(2);
  expect(pose(graph).position).toEqual(before);
  graph.tick(3.5);
  expect(pose(graph).position[0]).toBeCloseTo(5, 9);
  graph.dispose();
});

test('removing a behaviour restores the base transform; behaving nodes keep frames coming', () => {
  const graph = createSceneGraph();
  graph.reconcile(cube({ behaviour: behave('float') }));
  graph.tick(1);
  graph.drawn();
  expect(graph.needsFrame()).toBe(true);
  graph.reconcile(cube({}));
  graph.tick(2);
  graph.drawn();
  expect(pose(graph)).toEqual({ position: [1, 2, 3], rotation: [0, 0.5, 0] });
  expect(graph.needsFrame()).toBe(false);
  graph.dispose();
});
