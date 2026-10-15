/**
 * Scenes that reached the element through the typed `view` helper. TypeScript already
 * checked them against `SceneDescription`, so the Mount can skip the Schema decode (about
 * 0.6 ms per render for 1,000 meshes). Any other value assigned to the element's `scene`
 * property is still decoded.
 *
 * @module
 */
import type { SceneDescription } from '@opsydyn/effect-three';

const typed = new WeakMap<object, SceneDescription>();

/** Records a compile-time-checked scene and returns it unchanged. */
export const markTyped = (scene: SceneDescription): SceneDescription => {
  typed.set(scene, scene);
  return scene;
};

/** The scene, if this exact value came through `markTyped`. */
export const typedScene = (value: unknown): SceneDescription | undefined =>
  typeof value === 'object' && value !== null ? typed.get(value) : undefined;
