import { describe, expect, test } from 'bun:test';

import {
  box,
  createSceneGraph,
  cylinder,
  type Easing,
  ease,
  easeProgress,
  group,
  instant,
  mesh,
  plane,
  scene,
  type Transition,
  type Vec3,
  sphere,
  standard,
} from '../src/kernel/index.ts';
import { easingAndTimes } from './arbitraries.ts';
import { assertProperty } from './property.ts';
import { snapshot } from './support/snapshot.ts';

const easings: ReadonlyArray<Easing> = ['linear', 'easeInOutCubic', 'easeOutCubic', 'easeOutBack'];

const cubeMesh = (position: Vec3, transition: Transition, scale: Vec3 = [1, 1, 1]) =>
  mesh({
    key: 'a',
    geometry: box(),
    material: standard({ color: 0 }),
    position,
    scale,
    transition,
  });

const cubeAt = (position: Vec3, transition: Transition, scale: Vec3 = [1, 1, 1]) =>
  scene({ children: [cubeMesh(position, transition, scale)] });

const positionOf = (graph: ReturnType<typeof createSceneGraph>) =>
  graph.object('a')?.position.toArray();

const linearSecond = ease({ seconds: 1, easing: 'linear' });

describe('easing curves', () => {
  test('every curve starts at 0 and ends at 1', () => {
    for (const easing of easings) {
      expect(easeProgress(easing, 0)).toBeCloseTo(0, 12);
      expect(easeProgress(easing, 1)).toBeCloseTo(1, 12);
    }
  });

  test('easeInOutCubic is symmetric about the midpoint, and easeOutBack overshoots', () => {
    expect(easeProgress('easeInOutCubic', 0.5)).toBeCloseTo(0.5, 12);
    expect(easeProgress('easeInOutCubic', 0.25)).toBeCloseTo(
      1 - easeProgress('easeInOutCubic', 0.75),
      12,
    );
    expect(
      Math.max(...[0.6, 0.7, 0.8, 0.9].map((t) => easeProgress('easeOutBack', t))),
    ).toBeGreaterThan(1);
  });
});

describe('transitions', () => {
  test('a created node starts at its target', () => {
    const graph = createSceneGraph();
    graph.reconcile(cubeAt([4, 0, 0], linearSecond));
    expect(positionOf(graph)).toEqual([4, 0, 0]);
    graph.dispose();
  });

  test('an eased change starts from the old pose and lands exactly on the target', () => {
    const graph = createSceneGraph();
    graph.reconcile(cubeAt([0, 0, 0], linearSecond, [1, 1, 1]));
    graph.tick(10);
    graph.reconcile(cubeAt([4, 0, 0], linearSecond, [3, 3, 3]));
    expect(positionOf(graph)).toEqual([0, 0, 0]);
    graph.tick(10.25);
    expect(positionOf(graph)).toEqual([1, 0, 0]);
    expect(graph.object('a')?.scale.toArray()).toEqual([1.5, 1.5, 1.5]);
    graph.tick(11.5);
    expect(positionOf(graph)).toEqual([4, 0, 0]);
    expect(graph.object('a')?.scale.toArray()).toEqual([3, 3, 3]);
  });

  test('retargeting mid-flight continues from the current pose without a jump', () => {
    const graph = createSceneGraph();
    graph.reconcile(cubeAt([0, 0, 0], linearSecond));
    graph.reconcile(cubeAt([4, 0, 0], linearSecond));
    graph.tick(0.5);
    expect(positionOf(graph)).toEqual([2, 0, 0]);
    graph.reconcile(cubeAt([-2, 0, 0], linearSecond));
    expect(positionOf(graph)).toEqual([2, 0, 0]);
    graph.tick(0.5);
    expect(positionOf(graph)).toEqual([2, 0, 0]);
    graph.tick(1);
    expect(positionOf(graph)).toEqual([0, 0, 0]);
    graph.tick(1.5);
    expect(positionOf(graph)).toEqual([-2, 0, 0]);
    graph.dispose();
  });

  test('switching to instant mid-flight snaps to the target and stops the tween', () => {
    const graph = createSceneGraph();
    graph.reconcile(cubeAt([0, 0, 0], linearSecond));
    graph.reconcile(cubeAt([4, 0, 0], linearSecond));
    graph.tick(0.5);
    graph.reconcile(cubeAt([4, 0, 0], instant()));
    expect(positionOf(graph)).toEqual([4, 0, 0]);
    graph.tick(0.75);
    expect(positionOf(graph)).toEqual([4, 0, 0]);
    graph.dispose();
  });

  test('changing only the transition of a resting node does not move it', () => {
    const graph = createSceneGraph();
    graph.reconcile(cubeAt([4, 0, 0], instant()));
    const result = graph.reconcile(cubeAt([4, 0, 0], linearSecond));
    expect(result._tag === 'Applied' && result.ops).toEqual([
      { _tag: 'Update', node: expect.anything(), fields: ['transition'] },
    ]);
    graph.tick(0.5);
    expect(positionOf(graph)).toEqual([4, 0, 0]);
    graph.dispose();
  });

  test('groups ease, carrying children that keep their local pose', () => {
    const at = (x: number) =>
      scene({
        children: [
          group({
            key: 'g',
            position: [x, 0, 0],
            transition: linearSecond,
            children: [mesh({ key: 'a', geometry: box(), material: standard({ color: 0 }) })],
          }),
        ],
      });
    const graph = createSceneGraph();
    graph.reconcile(at(0));
    graph.reconcile(at(2));
    graph.tick(0.5);
    expect(graph.object('g')?.position.toArray()).toEqual([1, 0, 0]);
    expect(graph.object('a')?.position.toArray()).toEqual([0, 0, 0]);
    graph.dispose();
  });

  test('a node moving to another parent keeps its world position, then travels', () => {
    const shelves = (onLeft: boolean, transition: Transition) =>
      scene({
        children: [
          group({
            key: 'left',
            position: [-4, 0, 0],
            children: onLeft ? [cubeMesh([1, 0, 0], transition)] : [],
          }),
          group({
            key: 'right',
            position: [4, 0, 0],
            children: onLeft ? [] : [cubeMesh([1, 0, 0], transition)],
          }),
        ],
      });
    const eased = createSceneGraph();
    eased.reconcile(shelves(true, linearSecond));
    const object = eased.object('a');
    eased.reconcile(shelves(false, linearSecond));
    expect(eased.object('a')).toBe(object);
    expect(positionOf(eased)).toEqual([-7, 0, 0]);
    eased.tick(0.5);
    expect(positionOf(eased)).toEqual([-3, 0, 0]);
    eased.tick(1);
    expect(positionOf(eased)).toEqual([1, 0, 0]);
    eased.dispose();

    const snapped = createSceneGraph();
    snapped.reconcile(shelves(true, instant()));
    snapped.reconcile(shelves(false, instant()));
    expect(positionOf(snapped)).toEqual([1, 0, 0]);
    snapped.dispose();
  });

  test('while not animating, transitions land at once and any in flight finish', () => {
    const graph = createSceneGraph();
    graph.reconcile(cubeAt([0, 0, 0], linearSecond));
    graph.reconcile(cubeAt([4, 0, 0], linearSecond));
    graph.tick(0.5);
    graph.setAnimating(false);
    expect(positionOf(graph)).toEqual([4, 0, 0]);
    graph.reconcile(cubeAt([-4, 0, 0], linearSecond));
    expect(positionOf(graph)).toEqual([-4, 0, 0]);
    graph.setAnimating(true);
    graph.reconcile(cubeAt([0, 0, 0], linearSecond));
    expect(positionOf(graph)).toEqual([-4, 0, 0]);
    graph.tick(1);
    expect(positionOf(graph)).toEqual([-2, 0, 0]);
    graph.dispose();
  });

  test('an eased pose depends only on scene time, not on the frames in between', async () => {
    await assertProperty(easingAndTimes, ([easing, times]) => {
      const transition = ease({ seconds: 1, easing });
      const stepped = createSceneGraph();
      const direct = createSceneGraph();
      for (const graph of [stepped, direct]) {
        graph.reconcile(cubeAt([0, 0, 0], transition));
        graph.reconcile(cubeAt([3, -2, 1], transition, [2, 2, 2]));
      }
      const sorted = [...times].sort((a, b) => a - b);
      for (const time of sorted) stepped.tick(time);
      direct.tick(sorted.at(-1) ?? 0);
      expect(snapshot(stepped)).toEqual(snapshot(direct));
      stepped.dispose();
      direct.dispose();
    });
  });

  test('ticking many tweens allocates nothing', () => {
    const at = (x: number) =>
      scene({
        children: Array.from({ length: 200 }, (_, index) =>
          mesh({
            key: `m${index}`,
            geometry: box(),
            material: standard({ color: 0 }),
            position: [x, index, 0],
            transition: ease({ seconds: 1e9 }),
          }),
        ),
      });
    const graph = createSceneGraph();
    graph.reconcile(at(0));
    graph.reconcile(at(1));
    let time = 0;
    const frame = (): void => {
      time += 1 / 60;
      graph.tick(time);
    };
    for (let i = 0; i < 1000; i++) frame();
    Bun.gc(true);
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 10_000; i++) frame();
    const growth = (process.memoryUsage().heapUsed - before) / 10_000;
    expect(growth).toBeLessThan(8);
    graph.dispose();
  });
});

describe('shapes', () => {
  test('each shape builds its three.js geometry and replaces in place when its kind changes', () => {
    const graph = createSceneGraph();
    const shapes = [
      sphere({ radius: 2 }),
      plane({ width: 3 }),
      cylinder({ radiusTop: 0 }),
      box(),
    ] as const;
    for (const geometry of shapes) {
      graph.reconcile(
        scene({ children: [mesh({ key: 'a', geometry, material: standard({ color: 0 }) })] }),
      );
      expect(graph.store.stats().geometries.live).toBe(1);
    }
    expect(snapshot(graph)).toMatchObject({
      children: [{ detail: { geometry: { shape: { type: 'Box' } } } }],
    });
    graph.dispose();
    expect(graph.store.stats().geometries.live).toBe(0);
  });

  test('constructors fill in three.js defaults', () => {
    expect(sphere()).toEqual({
      _tag: 'Sphere',
      radius: 0.5,
      widthSegments: 32,
      heightSegments: 16,
    });
    expect(plane()).toEqual({ _tag: 'Plane', width: 1, height: 1 });
    expect(cylinder()).toEqual({
      _tag: 'Cylinder',
      radiusTop: 0.5,
      radiusBottom: 0.5,
      height: 1,
      radialSegments: 32,
    });
  });
});
