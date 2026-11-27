import type { SceneDescription } from '@opsydyn/effect-three';
import { mountSceneHost, type Environment } from '@opsydyn/effect-three/browser';
import { Effect, Layer, Queue, Stream } from 'effect';

/** Drive the core browser host directly for renderer and XR probes. */
export const showScenes = (
  environment: Environment,
  element: HTMLElement,
  initial: SceneDescription,
) => {
  const updates = Effect.runSync(Queue.sliding<SceneDescription>(1));
  const mount = mountSceneHost({
    environment,
    element,
    initial,
    updates: Stream.fromQueue(updates),
    liveChanges: Stream.empty,
  });
  const browser = Layer.effectDiscard(mount);
  Effect.runFork(Layer.launch(browser));
  return (scene: SceneDescription) => Queue.offerUnsafe(updates, scene);
};
