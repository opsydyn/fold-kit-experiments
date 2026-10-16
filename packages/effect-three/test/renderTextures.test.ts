import { expect, test } from 'bun:test';

import { Mesh, type Texture } from 'three';

import {
  box,
  createSceneGraph,
  createSceneLoop,
  fixed,
  mesh,
  type RenderTarget,
  recordingRendererFactory,
  renderTexture,
  type Rotation,
  scene,
  spin,
  standard,
} from '../src/kernel/index.ts';

const monitor = (options: {
  readonly screen?: Rotation;
  readonly width?: number;
  readonly keep?: boolean;
}) =>
  scene({
    renderTextures:
      options.keep === false
        ? []
        : [
            renderTexture({
              id: 'screen',
              width: options.width ?? 256,
              height: 128,
              background: 0x101020,
              children: [
                mesh({
                  key: 'shown',
                  geometry: box(),
                  material: standard({ color: 0xff8800 }),
                  rotation: options.screen ?? fixed([0, 0, 0]),
                }),
              ],
            }),
          ],
    children: [mesh({ key: 'tv', geometry: box(), material: standard({ map: 'screen' }) })],
  });

/** A loop over `graph` whose renderer records renders into targets and created targets. */
const harness = (graph: ReturnType<typeof createSceneGraph>) => {
  const recorded = recordingRendererFactory().create();
  const intoTargets: Array<RenderTarget> = [];
  const created: Array<{ readonly width: number; readonly height: number; disposed: boolean }> = [];
  const renderer = {
    ...recorded,
    render: (...args: Parameters<typeof recorded.render>) => {
      if (args[3] !== undefined) intoTargets.push(args[3]);
      recorded.render(...args);
    },
    createTarget: (width: number, height: number) => {
      const target = recorded.createTarget(width, height);
      const record = { width, height, disposed: false };
      created.push(record);
      return {
        texture: target.texture,
        dispose: () => {
          record.disposed = true;
          target.dispose();
        },
      };
    },
  };
  const loop = createSceneLoop({ graph, renderer, elapsedSeconds: () => 0, emit: () => undefined });
  return { loop, intoTargets, created };
};

const mapOf = (graph: ReturnType<typeof createSceneGraph>): Texture | null => {
  const tv = graph.object('tv');
  return tv instanceof Mesh ? Reflect.get(tv.material, 'map') : null;
};

test('a render texture draws once into its target and becomes the map that names it', () => {
  const graph = createSceneGraph();
  graph.reconcile(monitor({}));
  const { loop, intoTargets, created } = harness(graph);
  loop.frame();
  loop.frame();
  expect(created).toEqual([{ width: 256, height: 128, disposed: false }]);
  expect(intoTargets).toHaveLength(1);
  expect(mapOf(graph)).toBe(intoTargets[0]?.texture ?? null);
  expect(graph.renderTextures()[0]?.graph.scene.background).not.toBeNull();

  // A change inside the texture's scene redraws it; the target is kept.
  graph.reconcile(monitor({ screen: fixed([0, 1, 0]) }));
  loop.frame();
  expect(intoTargets).toHaveLength(2);
  expect(created).toHaveLength(1);

  // A new size needs a new target; the old one is disposed.
  graph.reconcile(monitor({ screen: fixed([0, 1, 0]), width: 512 }));
  loop.frame();
  expect(created.map((target) => [target.width, target.disposed])).toEqual([
    [256, true],
    [512, false],
  ]);
  graph.dispose();
});

test('an animated texture keeps frames coming; removing it withdraws the map', () => {
  const graph = createSceneGraph();
  graph.reconcile(monitor({ screen: spin({ axis: 'y', radiansPerSecond: 1 }) }));
  const { loop, created } = harness(graph);
  loop.frame();
  expect(graph.needsFrame()).toBe(true);

  graph.reconcile(monitor({ keep: false }));
  loop.frame();
  expect(mapOf(graph)).toBeNull();
  expect(created[0]?.disposed).toBe(true);
  expect(graph.renderTextures()).toEqual([]);
  loop.dispose();
  graph.dispose();
});

test('an invalid texture scene rejects the whole update', () => {
  const graph = createSceneGraph();
  graph.reconcile(monitor({}));
  const twice = mesh({ key: 'x', geometry: box(), material: standard() });
  const result = graph.reconcile(
    scene({
      renderTextures: [renderTexture({ id: 'screen', children: [twice, twice] })],
      children: [mesh({ key: 'other', geometry: box(), material: standard() })],
    }),
  );
  expect(result).toEqual({ _tag: 'Invalid', error: { _tag: 'DuplicateKey', key: 'x' } });
  expect(graph.object('tv')).toBeDefined();
  expect(graph.object('other')).toBeUndefined();
  graph.dispose();
});
