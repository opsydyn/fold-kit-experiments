/**
 * Loading textures and glTF models by URL, as Effects an application runs from a Foldkit
 * Command and settles into `AsyncData`. Each asset is lent to the shared resource store
 * under an id: materials use a texture with `map: id`, and a `borrowed({ id })` node shows
 * a model. The environment owns what it loads: loading an id again replaces and disposes
 * the earlier asset, and `unload` or the environment's `dispose` frees it.
 *
 * @module
 */
import type { ResourceStore } from '@opsydyn/effect-three';
import { Data, Effect } from 'effect';
import { type Object3D, SRGBColorSpace, type Texture, TextureLoader } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { disposeModel, namesIn } from './dom/models.ts';

/** An asset could not be fetched or decoded. */
export class AssetLoadError extends Data.TaggedError('AssetLoadError')<{
  readonly url: string;
  readonly cause: unknown;
}> {}

/** What a loaded model offers: named parts to match hits against, and animation clips. */
export type ModelInfo = {
  readonly id: string;
  /** Names of the objects inside the model, as hits report them in `part`. */
  readonly parts: ReadonlyArray<string>;
  /** Names of the model's animation clips. */
  readonly clips: ReadonlyArray<string>;
};

/** Creates the asset loader for a store. One per environment. */
export const makeAssets = (store: ResourceStore) => {
  const releases = new Map<string, () => void>();

  /** Takes ownership of an asset under `id`, first releasing whatever was there. */
  const own = (id: string, release: () => void): void => {
    releases.get(id)?.();
    releases.set(id, release);
  };

  const lendTexture = (id: string) => (texture: Texture) => {
    texture.colorSpace = SRGBColorSpace;
    const withdraw = store.lendTexture(id, texture);
    own(id, () => {
      withdraw();
      texture.dispose();
    });
    return id;
  };

  const lendModel =
    (id: string) =>
    (gltf: { readonly scene: Object3D; readonly animations: Object3D['animations'] }) => {
      // Keep the clips with the object, so a borrowed node can play them by name.
      gltf.scene.animations = gltf.animations;
      const withdraw = store.lend(id, gltf.scene);
      own(id, () => {
        withdraw();
        disposeModel(gltf.scene);
      });
      const info: ModelInfo = {
        id,
        parts: namesIn(gltf.scene),
        clips: gltf.animations.map((clip) => clip.name),
      };
      return info;
    };

  const releaseAll = (): void => {
    for (const release of releases.values()) release();
    releases.clear();
  };

  return {
    /** Loads a colour texture (sRGB) and lends it under `id`. Succeeds with the id. */
    loadTexture: (id: string, url: string) => {
      const load = Effect.tryPromise({
        try: () => new TextureLoader().loadAsync(url),
        catch: (cause) => new AssetLoadError({ url, cause }),
      });
      return Effect.map(load, lendTexture(id));
    },
    /** Loads a glTF or GLB model and lends its scene under `id`, with its clips. */
    loadModel: (id: string, url: string) => {
      const load = Effect.tryPromise({
        try: () => new GLTFLoader().loadAsync(url),
        catch: (cause) => new AssetLoadError({ url, cause }),
      });
      return Effect.map(load, lendModel(id));
    },
    /** Withdraws and disposes the asset loaded under `id`, if any. */
    unload: (id: string) =>
      Effect.sync(() => {
        releases.get(id)?.();
        releases.delete(id);
      }),
    /** Withdraws and disposes every loaded asset. */
    dispose: releaseAll,
  };
};

export type Assets = ReturnType<typeof makeAssets>;
