import { expect, test } from 'bun:test';

import { Group, Mesh, PlaneGeometry } from 'three';

import {
  createSceneGraph,
  type LabelEngine,
  type LabelNode,
  label,
  scene,
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

test('a render kit that cannot draw labels gets none from the engine', () => {
  const { engine, calls } = fakeLabels();
  const kit = { ...webglKit, drawsLabels: false };
  const graph = createSceneGraph({ labels: engine, kit });
  graph.reconcile(sign());
  expect(calls).toEqual([]);
  expect(graph.object('sign')?.children).toEqual([]);
  graph.dispose();
});
