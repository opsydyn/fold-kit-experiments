import { expect, test } from 'bun:test';

import { EquirectangularReflectionMapping, Texture } from 'three';

import {
  createSceneGraph,
  createSceneLoop,
  environment,
  type Environment,
  recordingRendererFactory,
  scene,
} from '../src/kernel/index.ts';

/** A loop whose renderer counts the room environments it makes and frees. */
const harness = () => {
  const graph = createSceneGraph();
  const recorded = recordingRendererFactory().create();
  const rooms = { made: 0, freed: 0 };
  const renderer = {
    ...recorded,
    createEnvironment: () => {
      rooms.made++;
      const room = recorded.createEnvironment();
      return {
        texture: room.texture,
        dispose: () => {
          rooms.freed++;
          room.dispose();
        },
      };
    },
  };
  const loop = createSceneLoop({ graph, renderer, elapsedSeconds: () => 0, emit: () => undefined });
  const show = (lighting: Environment | undefined) => {
    graph.reconcile(scene(lighting === undefined ? {} : { environment: lighting }));
    loop.frame();
  };
  return { graph, loop, rooms, show };
};

test('the room environment lights the scene; background and intensities as Drei sets them', () => {
  const { graph, rooms, show } = harness();
  show(environment());
  const room = graph.scene.environment;
  expect(room).toBeInstanceOf(Texture);
  expect(graph.scene.background).toBeNull();

  show(environment({ background: true, backgroundBlurriness: 0.3, environmentIntensity: 0.6 }));
  expect(graph.scene.environment).toBe(room);
  expect(graph.scene.background).toBe(room);
  expect(graph.scene.backgroundBlurriness).toBe(0.3);
  expect(graph.scene.environmentIntensity).toBe(0.6);

  show(environment({ background: 'only' }));
  expect(graph.scene.environment).toBeNull();
  expect(graph.scene.background).toBe(room);
  // One room, made once, however its settings change.
  expect(rooms).toEqual({ made: 1, freed: 0 });

  show(undefined);
  expect([graph.scene.environment, graph.scene.background]).toEqual([null, null]);
  expect(rooms).toEqual({ made: 1, freed: 1 });
});

test('a lent panorama becomes the environment when it arrives, mapped for reflection', () => {
  const { graph, loop, rooms, show } = harness();
  show(environment({ map: 'sky' }));
  expect(graph.scene.environment).toBeNull();
  const panorama = new Texture();
  graph.store.lendTexture('sky', panorama);
  expect(graph.needsFrame()).toBe(true);
  loop.frame();
  expect(graph.scene.environment).toBe(panorama);
  expect(panorama.mapping).toBe(EquirectangularReflectionMapping);
  expect(rooms.made).toBe(0);
  loop.dispose();
});

test('changing only the environment asks for a frame, and disposing frees the room', () => {
  const { graph, loop, rooms, show } = harness();
  show(environment());
  graph.drawn();
  expect(graph.reconcile(scene({ environment: environment({ environmentIntensity: 2 }) }))).toEqual(
    { _tag: 'Applied', ops: [] },
  );
  expect(graph.needsFrame()).toBe(true);
  loop.dispose();
  expect(rooms.freed).toBe(1);
});
