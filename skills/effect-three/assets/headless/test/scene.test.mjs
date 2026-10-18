import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSceneGraph, scene } from '@opsydyn/effect-three/kernel';

import { clicked, model, sceneFor } from '../dist/scene.js';

const applied = (result) => {
  assert.equal(result._tag, 'Applied', JSON.stringify(result));
  return result.ops;
};

test('a model update moves the same three.js object; nothing else changes', () => {
  const graph = createSceneGraph();
  applied(graph.reconcile(sceneFor(model)));
  const before = graph.object('crate-b');
  const ops = applied(graph.reconcile(sceneFor(clicked(model, 'crate-b'))));
  assert.equal(graph.object('crate-b'), before);
  assert.deepEqual(graph.object('crate-b').position.toArray(), [0, 0.5, 0]);
  assert.equal(ops.length, 1);
  // An equal scene is no work at all.
  assert.deepEqual(applied(graph.reconcile(sceneFor(clicked(model, 'crate-b')))), []);
  graph.dispose();
});

test('removing a crate frees what only it held; the shared box lives on', () => {
  const graph = createSceneGraph();
  applied(graph.reconcile(sceneFor(model)));
  // Three owned materials and one shared geometry.
  assert.equal(graph.store.stats().materials.live, 3);
  applied(graph.reconcile(sceneFor({ ...model, crates: model.crates.slice(1) })));
  assert.equal(graph.object('crate-a'), undefined);
  assert.equal(graph.store.stats().materials.live, 2);
  assert.equal(graph.store.stats().geometries.live, 1);
  graph.dispose();
  assert.equal(graph.store.stats().materials.live, 0);
});

test('an invalid description is rejected whole, never half applied', () => {
  const graph = createSceneGraph();
  applied(graph.reconcile(sceneFor(model)));
  const twice = sceneFor({ ...model, crates: [model.crates[0], model.crates[0]] });
  assert.deepEqual(graph.reconcile(twice), {
    _tag: 'Invalid',
    error: { _tag: 'DuplicateKey', key: 'crate-a' },
  });
  assert.notEqual(graph.object('crate-c'), undefined);
  assert.equal(graph.reconcile(scene({}))._tag, 'Applied');
  graph.dispose();
});
