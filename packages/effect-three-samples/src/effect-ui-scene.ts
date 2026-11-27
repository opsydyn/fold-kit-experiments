import type { PhysicsEngine } from '@opsydyn/effect-three';
import { defineScopedSceneMount } from '@opsydyn/effect-three-foldkit';
import { troikaLabels } from '@opsydyn/effect-three-troika/webgpu';
import { makeEnvironment, type Environment } from '@opsydyn/effect-three/browser';
import { Effect } from 'effect';

import { rendererForPage } from './renderer';

export {
  defineScopedSceneMount,
  sceneElement as EffectThreeStage,
  SceneLifecycle as SceneStart,
} from '@opsydyn/effect-three-foldkit';

export function scopedSceneEnvironment(createEnvironment: () => Environment) {
  const acquire = Effect.sync(createEnvironment);
  const environment = Effect.acquireRelease(acquire, (created) => Effect.sync(created.dispose));
  return environment.pipe(Effect.withSpan('effect-three.samples.environment'));
}

export const defineEffectThreeMount = (createEnvironment: () => Environment) =>
  defineScopedSceneMount(scopedSceneEnvironment(createEnvironment));

export const createLabelledEnvironment = (loadPhysics?: () => Promise<PhysicsEngine>) => {
  const options = { renderer: rendererForPage(window), labels: troikaLabels() };
  return makeEnvironment(
    window,
    loadPhysics === undefined ? options : { ...options, physics: loadPhysics() },
  );
};

export const defineLabelledSceneMount = (loadPhysics?: () => Promise<PhysicsEngine>) =>
  defineEffectThreeMount(() => createLabelledEnvironment(loadPhysics));

export const unlabelledSceneMount = defineEffectThreeMount(() =>
  makeEnvironment(window, { renderer: rendererForPage(window) }),
);
