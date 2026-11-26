/**
 * Rapier's deterministic build keeps each peer's world in step (ADR-014).
 * With `?physics=worker` the world steps in a worker instead (ADR-017).
 */
import { makeEnvironment } from '@opsydyn/effect-three-foldkit/browser';
import { loadRapier } from '@opsydyn/effect-three-rapier/deterministic';
import { remotePhysics } from '@opsydyn/effect-three-rapier/worker';
import { Effect } from 'effect';

import { defineScopedSceneMount } from '../effect-ui-scene';
import { rendererForPage } from '../renderer';

const createWorker = () =>
  new Worker(new URL('./physics.worker.ts', import.meta.url), { type: 'module' });

const openWorker = Effect.sync(createWorker);
const worker = Effect.acquireRelease(openWorker, (active) => Effect.sync(() => active.terminate()));

function* acquireEnvironment() {
  const inWorker = new URL(window.location.href).searchParams.get('physics') === 'worker';
  const physics = inWorker ? remotePhysics(yield* worker) : loadRapier();
  return makeEnvironment(window, { renderer: rendererForPage(window), physics });
}

const openEnvironment = Effect.gen(acquireEnvironment);
const scopedEnvironment = Effect.acquireRelease(openEnvironment, (created) =>
  Effect.sync(created.dispose),
);

export const sceneMount = defineScopedSceneMount(
  scopedEnvironment.pipe(Effect.withSpan('effect-three.tabletop.environment')),
);
