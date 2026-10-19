import { expect, test } from 'bun:test';

import { Group, Mesh, PlaneGeometry } from 'three';

import {
  createSceneGraph,
  createSceneLoop,
  type LabelEngine,
  type LabelNode,
  label,
  type MaterialRef,
  recordingRendererFactory,
  type SceneEvent,
  scene,
  sharedMaterial,
  standard,
} from '../src/kernel/index.ts';
import { webglKit } from '../src/webgl/index.ts';

/** A label engine that draws each label as a plane and logs what it is asked to do. */
const fakeLabels = () => {
  const calls: Array<string> = [];
  const ready: Array<() => void> = [];
  const engine: LabelEngine = {
    create: (node: LabelNode, done) => {
      calls.push(`create ${node.text}`);
      ready.push(done);
      return {
        object: new Mesh(new PlaneGeometry()),
        update: (next) => calls.push(`update ${next.text}`),
        setMaterial: (material) => {
          if (material !== undefined) calls.push(`material ${material.type}`);
        },
        // Half a unit of width per character, one tall.
        layout: () => ({
          block: [-node.text.length / 4, -0.5, node.text.length / 4, 0.5],
          visible: [-node.text.length / 4, -0.4, node.text.length / 4, 0.4],
        }),
        dispose: () => calls.push('dispose'),
      };
    },
  };
  return { engine, calls, ready };
};

const sign = (options: Partial<Parameters<typeof label>[0]> = {}) =>
  scene({ children: [label({ key: 'sign', text: 'Hello', ...options })] });

test('a label is drawn by the engine inside its wrapper; only type changes reach it', () => {
  const { engine, calls } = fakeLabels();
  const graph = createSceneGraph({ labels: engine });
  graph.reconcile(sign({ position: [1, 2, 3] }));
  const wrapper = graph.object('sign');
  expect(wrapper).toBeInstanceOf(Group);
  expect(wrapper?.position.toArray()).toEqual([1, 2, 3]);
  expect(wrapper?.children[0]).toBeInstanceOf(Mesh);

  // Moving the label moves the wrapper; new text or colour goes to the engine.
  graph.reconcile(sign({ position: [4, 5, 6] }));
  expect(calls).toEqual(['create Hello']);
  graph.reconcile(sign({ position: [4, 5, 6], text: 'Bye', color: 0xff0000 }));
  expect(calls).toEqual(['create Hello', 'update Bye']);

  graph.reconcile(scene({ children: [] }));
  expect(calls.at(-1)).toBe('dispose');
  graph.dispose();
});

test('a label whose glyphs are ready asks for a frame', () => {
  const { engine, ready } = fakeLabels();
  const graph = createSceneGraph({ labels: engine });
  graph.reconcile(sign());
  graph.drawn();
  expect(graph.needsFrame()).toBe(false);
  let woken = 0;
  graph.onInvalidated(() => woken++);
  ready[0]?.();
  expect(woken).toBe(1);
  expect(graph.needsFrame()).toBe(true);
  graph.dispose();
});

test('without an engine a label is an empty wrapper', () => {
  const graph = createSceneGraph();
  graph.reconcile(sign());
  expect(graph.object('sign')?.children).toEqual([]);
  graph.dispose();
});

test('a TSL render kit draws with the engine’s TSL labels, and none without them', () => {
  const kit = { ...webglKit, shading: 'tsl' as const };
  const glslOnly = fakeLabels();
  const withoutTsl = createSceneGraph({ labels: glslOnly.engine, kit });
  withoutTsl.reconcile(sign());
  expect(glslOnly.calls).toEqual([]);
  expect(withoutTsl.object('sign')?.children).toEqual([]);
  withoutTsl.dispose();

  // An engine with both: the TSL kit asks the TSL implementation, never the GLSL one.
  const glsl = fakeLabels();
  const tsl = fakeLabels();
  const engine: LabelEngine = { create: glsl.engine.create, createTsl: tsl.engine.create };
  const graph = createSceneGraph({ labels: engine, kit });
  graph.reconcile(sign());
  expect(tsl.calls).toEqual(['create Hello']);
  expect(glsl.calls).toEqual([]);
  expect(graph.object('sign')?.children[0]).toBeInstanceOf(Mesh);
  graph.dispose();
});

test('a label lends its material to the engine, swaps it, and gives it back', () => {
  const { engine, calls } = fakeLabels();
  const graph = createSceneGraph({ labels: engine });
  const shared = {
    geometries: [],
    materials: [{ id: 'gold', material: standard({ metalness: 1 }) }],
  };
  const lit = (material: MaterialRef | null) =>
    scene({ resources: shared, children: [label({ key: 'sign', text: 'Hello', material })] });
  graph.reconcile(lit(standard({ roughness: 0.2 })));
  expect(calls).toEqual(['create Hello', 'material MeshStandardMaterial']);
  // Its own material changes in place, as a mesh's does: nothing new to lend.
  graph.reconcile(lit(standard({ roughness: 0.8 })));
  expect(calls).toHaveLength(2);
  expect(graph.store.stats().materials.live).toBe(1);
  // A shared one replaces it; back to the engine's own frees it.
  graph.reconcile(lit(sharedMaterial('gold')));
  expect(calls.at(-1)).toBe('material MeshStandardMaterial');
  expect(graph.store.stats().sharedMaterialUsers.get('gold')).toBe(1);
  graph.reconcile(lit(null));
  expect(graph.store.stats().materials.live).toBe(0);
  expect(graph.reconcile(lit(sharedMaterial('missing')))).toEqual({
    _tag: 'Invalid',
    error: { _tag: 'UnknownSharedMaterial', nodeKey: 'sign', id: 'missing' },
  });
  graph.dispose();
});

test('a measured label reports its laid-out size, once per change', () => {
  const { engine } = fakeLabels();
  const graph = createSceneGraph({ labels: engine });
  const events: Array<SceneEvent> = [];
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => 0,
    emit: (event) => events.push(event),
  });
  const sized = (text: string) =>
    scene({ measure: ['sign'], children: [label({ key: 'sign', text, scale: [2, 2, 2] })] });
  graph.reconcile(sized('Hello'));
  loop.frame();
  loop.frame();
  const laidOut = () => events.filter((event) => event._tag === 'LabelMeasured');
  // In its own units, before its scale: five characters, half a unit each.
  expect(laidOut()).toEqual([
    {
      _tag: 'LabelMeasured',
      key: 'sign',
      block: [-1.25, -0.5, 1.25, 0.5],
      visible: [-1.25, -0.4, 1.25, 0.4],
    },
  ]);
  graph.dispose();
});
