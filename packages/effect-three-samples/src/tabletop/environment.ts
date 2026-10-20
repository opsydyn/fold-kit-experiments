/**
 * The tabletop's own environment: the samples' renderer, plus Rapier's deterministic
 * build, so peers on different machines simulate the same world (ADR-014). With
 * `?physics=worker` the world steps in a worker instead (ADR-017), and agrees with peers
 * whose worlds step in their pages.
 */
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { loadRapier } from '@opsydyn/effect-three-rapier/deterministic';
import { remotePhysics } from '@opsydyn/effect-three-rapier/worker';

import { rendererForPage } from '../renderer';

/** Whether the page asks for its physics in a worker. */
export const physicsInWorker = (page: Window): boolean =>
  new URL(page.location.href).searchParams.get('physics') === 'worker';

const physicsFor = (page: Window) =>
  physicsInWorker(page)
    ? remotePhysics(new Worker(new URL('./physics.worker.ts', import.meta.url), { type: 'module' }))
    : loadRapier();

export const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: rendererForPage(window),
  physics: physicsFor(window),
});

export const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);
