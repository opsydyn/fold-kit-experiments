import { describe, expect, test } from 'bun:test';

import {
  box,
  createSceneGraph,
  mesh,
  type ReconcileResult,
  scene as makeScene,
  type SceneDescription,
  type SceneGraph,
  standard,
} from '../src/kernel/index.ts';
import { nonEmptyScene, scene, scenePair, sceneSequence, spinAndTimes } from './arbitraries.ts';
import { assertProperty } from './property.ts';
import { raise } from './support/holds.ts';
import { allNodes, expectedResources, perturb, replaceNode } from './support/scenes.ts';
import { snapshot } from './support/snapshot.ts';

const applied = (result: ReconcileResult) => {
  if (result._tag !== 'Applied') throw new Error(`unexpected ${result.error._tag}`);
  return result.ops;
};

/** Longer than any generated transition, so every tween has landed. */
const settleSeconds = 2;

/**
 * The description with its camera still. A turning camera (`autoRotate`) has turned for
 * as long as its pose has gone undescribed, so where it is depends on history, not on the
 * description and the time alone; `autoRotate.test.ts` covers it.
 */
// Turning and shaking depend on when they began, not only on the description: hold them.
const still = (description: SceneDescription): SceneDescription => ({
  ...description,
  camera: { ...description.camera, autoRotate: 0, shake: null },
  renderTextures: description.renderTextures.map((texture) => ({
    ...texture,
    camera: { ...texture.camera, autoRotate: 0, shake: null },
  })),
  views: description.views.map((view) => ({
    ...view,
    camera: { ...view.camera, autoRotate: 0, shake: null },
  })),
});

const freshSnapshot = (description: SceneDescription, time: number): unknown => {
  const graph = createSceneGraph();
  applied(graph.reconcile(description));
  graph.tick(time);
  const result = snapshot(graph);
  graph.dispose();
  return result;
};

const expectResourcesMatch = (graph: SceneGraph, description: SceneDescription): void => {
  const expected = expectedResources(description);
  const stats = graph.store.stats();
  expect(stats.geometries.live).toBe(expected.liveGeometries);
  expect(stats.materials.live).toBe(expected.liveMaterials);
  expect(stats.sharedGeometryUsers).toEqual(expected.sharedGeometryUsers);
  expect(stats.sharedMaterialUsers).toEqual(expected.sharedMaterialUsers);
};

describe('reconcile properties', () => {
  test('convergence: any sequence settles to the same host state as a fresh build, with balanced resources', async () => {
    await assertProperty(sceneSequence, (sequence) => {
      const graph = createSceneGraph();
      let time = 0;
      for (const turning of sequence) {
        const description = still(turning);
        applied(graph.reconcile(description));
        time += settleSeconds;
        graph.tick(time);
        expect(snapshot(graph)).toEqual(freshSnapshot(description, time));
        expectResourcesMatch(graph, description);
      }
      graph.dispose();
      const stats = graph.store.stats();
      expect(stats.geometries.live).toBe(0);
      expect(stats.materials.live).toBe(0);
    });
  });

  test('idempotence: a structurally equal description produces no ops', async () => {
    await assertProperty(scene, (description) => {
      const graph = createSceneGraph();
      applied(graph.reconcile(description));
      expect(applied(graph.reconcile(structuredClone(description)))).toEqual([]);
      graph.dispose();
    });
  });

  test('identity: nodes keeping their key and kind keep their three.js object', async () => {
    await assertProperty(scenePair, ([a, b]) => {
      const graph = createSceneGraph();
      applied(graph.reconcile(a));
      const before = new Map(allNodes(a.children).map((node) => [node.key, node._tag] as const));
      const objects = new Map(
        allNodes(a.children).map((node) => [node.key, graph.object(node.key)]),
      );
      applied(graph.reconcile(b));
      for (const node of allNodes(b.children)) {
        if (before.get(node.key) === node._tag)
          expect(graph.object(node.key)).toBe(objects.get(node.key));
        else expect(graph.object(node.key)).not.toBe(objects.get(node.key));
      }
      graph.dispose();
    });
  });

  test('minimality: changing one field of one node emits exactly one Update for that field', async () => {
    await assertProperty(nonEmptyScene, (description) => {
      const target = allNodes(description.children)[0] ?? raise(new Error('empty scene'));
      const graph = createSceneGraph();
      applied(graph.reconcile(description));
      const changed = perturb(target);
      const next = {
        ...description,
        children: replaceNode(description.children, target.key, changed.node),
      };
      expect(applied(graph.reconcile(next))).toEqual([
        { _tag: 'Update', node: changed.node, fields: [changed.field] },
      ]);
      graph.dispose();
    });
  });

  test('atomicity: a duplicate key is rejected and nothing changes', async () => {
    await assertProperty(scenePair, ([a, b]) => {
      const graph = createSceneGraph();
      applied(graph.reconcile(a));
      const before = snapshot(graph);
      const stats = graph.store.stats();
      const duplicate = mesh({ key: 'dup', geometry: box(), material: standard({ color: 0 }) });
      const invalid = { ...b, children: [...b.children, duplicate, duplicate] };
      expect(graph.reconcile(invalid)).toEqual({
        _tag: 'Invalid',
        error: { _tag: 'DuplicateKey', key: 'dup' },
      });
      expect(snapshot(graph)).toEqual(before);
      expect(graph.store.stats()).toEqual(stats);
      graph.dispose();
    });
  });
});

describe('behaviour properties', () => {
  test('spin is frame-rate independent: any frame history gives the same pose at time t', async () => {
    await assertProperty(spinAndTimes, ([parameters, times]) => {
      const rotation = { _tag: 'Spin' as const, ...parameters };
      const description = makeScene({
        children: [mesh({ key: 'a', geometry: box(), material: standard({ color: 0 }), rotation })],
      });
      const stepped = createSceneGraph();
      const direct = createSceneGraph();
      applied(stepped.reconcile(description));
      applied(direct.reconcile(description));
      for (const time of times) stepped.tick(time);
      const last = times.at(-1) ?? 0;
      direct.tick(last);
      expect(stepped.object('a')?.rotation.toArray()).toEqual(
        direct.object('a')?.rotation.toArray(),
      );
      stepped.dispose();
      direct.dispose();
    });
  });
});
