/**
 * Rapier's deterministic build for `@opsydyn/effect-three`: the same engine as the main
 * entry, over `@dimforge/rapier3d-deterministic-compat` (install it alongside), which
 * gives bit-identical results on every platform for the same inputs at the same steps.
 * Use it where peers must agree (ADR-014): a lockstep session between machines, or a
 * replay shared as a link.
 *
 * ```ts
 * import { loadRapier } from '@opsydyn/effect-three-rapier/deterministic';
 * const physics = await loadRapier();
 * ```
 *
 * Determinism covers the engine. What a scene feeds it must agree too: the same bodies,
 * added in the same order, with the same colliders, at the same steps.
 *
 * @module
 */
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import type { PhysicsEngine } from '@opsydyn/effect-three';

import { engineOf, type Rapier } from './engine.ts';

/**
 * Loads the deterministic Rapier build's WebAssembly and returns the engine. Call once
 * per page.
 */
export const loadRapier = async (): Promise<PhysicsEngine> => {
  await RAPIER.init();
  // SAFETY: the deterministic build is the same source as `rapier3d-compat` at the same
  // version, built with another feature: the same API, typed by separate declarations
  // that TypeScript keeps apart only by their private fields. The tests run it.
  return engineOf(RAPIER as unknown as Rapier);
};
