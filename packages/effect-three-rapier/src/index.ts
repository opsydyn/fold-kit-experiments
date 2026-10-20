/**
 * Rapier physics for `@opsydyn/effect-three`: a `PhysicsEngine` that the scene graph
 * steps. Load it once, before making the environment, and pass it on:
 *
 * ```ts
 * const physics = await loadRapier();
 * const environment = EffectThreeFoldkit.makeEnvironment(window, { physics });
 * ```
 *
 * Bodies are described on meshes (`body()`) under a scene's `physics()`; this package
 * only turns those descriptions into Rapier bodies and colliders, as react-three-rapier's
 * `RigidBody` does (`ae5c3fe`, `src/utils/utils-rigidbody.ts` and `utils-collider.ts`),
 * and joints into impulse joints, as its joint hooks do (`src/hooks/joints.ts`).
 *
 * Rapier (`@dimforge/rapier3d-compat`) is Apache-2.0; its WebAssembly is embedded, so
 * nothing extra is fetched. For a simulation that must come out the same on every
 * machine (lockstep, replays shared as links), load Rapier's deterministic build from
 * `@opsydyn/effect-three-rapier/deterministic` instead.
 *
 * @module
 */
import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsEngine } from '@opsydyn/effect-three';

import { engineOf } from './engine.ts';

/**
 * Loads Rapier's WebAssembly and returns the engine. Call once per page; the engine makes
 * a world for each scene with physics.
 */
export const loadRapier = async (): Promise<PhysicsEngine> => {
  await RAPIER.init();
  return engineOf(RAPIER);
};
