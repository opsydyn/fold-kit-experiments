import { expect, test } from 'bun:test';

import { DirectionalLight, Mesh } from 'three';

import {
  box,
  createSceneGraph,
  createSceneLoop,
  directionalLight,
  mesh,
  recordingRendererFactory,
  renderSettings,
  scene,
  standard,
} from '../src/kernel/index.ts';

const lit = (options: { readonly mapSize: number; readonly cast: boolean }) =>
  scene({
    render: renderSettings({ shadows: 'soft' }),
    children: [
      directionalLight({
        key: 'sun',
        position: [2, 4, 3],
        castShadow: options.cast,
        shadowMapSize: options.mapSize,
        shadowBias: -0.0005,
        shadowArea: 8,
      }),
      mesh({ key: 'cube', geometry: box(), material: standard(), castShadow: options.cast }),
      mesh({ key: 'floor', geometry: box(), material: standard(), receiveShadow: true }),
    ],
  });

test('shadow flags and light shadow settings reach three.js objects and update in place', () => {
  const graph = createSceneGraph();
  graph.reconcile(lit({ mapSize: 1024, cast: true }));
  const sun = graph.object('sun');
  const cube = graph.object('cube');
  if (!(sun instanceof DirectionalLight) || !(cube instanceof Mesh)) throw new Error('kinds');
  expect(sun.castShadow).toBe(true);
  expect(sun.shadow.mapSize.toArray()).toEqual([1024, 1024]);
  expect(sun.shadow.bias).toBe(-0.0005);
  expect([sun.shadow.camera.left, sun.shadow.camera.right]).toEqual([-8, 8]);
  expect(cube.castShadow).toBe(true);
  expect(graph.object('floor')?.receiveShadow).toBe(true);

  graph.reconcile(lit({ mapSize: 2048, cast: false }));
  expect(graph.object('sun')).toBe(sun);
  expect(sun.castShadow).toBe(false);
  expect(sun.shadow.mapSize.toArray()).toEqual([2048, 2048]);
  expect(cube.castShadow).toBe(false);
  graph.dispose();
});

test('the loop configures the renderer before the first frame and again only on change', () => {
  const graph = createSceneGraph();
  const renderers = recordingRendererFactory();
  const renderer = renderers.create();
  const configured = () => renderers.created()[0]?.configured() ?? [];
  const loop = createSceneLoop({ graph, renderer, elapsedSeconds: () => 0, emit: () => undefined });
  graph.reconcile(lit({ mapSize: 512, cast: true }));
  loop.frame();
  loop.frame();
  expect(configured()).toEqual([renderSettings({ shadows: 'soft' })]);

  // A structurally equal scene keeps the same settings value: no reconfiguration.
  graph.reconcile(lit({ mapSize: 512, cast: true }));
  loop.frame();
  expect(configured()).toHaveLength(1);

  graph.reconcile({ ...lit({ mapSize: 512, cast: true }), render: renderSettings() });
  loop.frame();
  expect(configured().at(-1)).toEqual(renderSettings());
  expect(configured()).toHaveLength(2);
  graph.dispose();
});
