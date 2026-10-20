/**
 * Loading textures, glTF models, HDR panoramas and typeface fonts by URL. Each asset is
 * lent to the shared resource store under an id: materials use a texture with `map: id`,
 * a `borrowed({ id })` node shows a model, `environment({ map: id })` a panorama, and
 * `text({ font: id })` geometry draws with a font.
 *
 * Two ways in. A scene can ask for assets in its description (`scene({ assets })`), and
 * the environment's registry loads, shares, cancels and frees them as scenes ask
 * (`assetLoader` is what it loads with; ADR-015). Or an application loads one with an
 * Effect from a Command and settles it into `AsyncData`; the environment owns what it
 * loads that way, loading an id again replaces and disposes the earlier asset, and
 * `unload` or the environment's `dispose` frees it. Use one way for any one id.
 *
 * @module
 */
import type { Asset, AssetKind, ResourceStore } from '@opsydyn/effect-three';
import { Data, Effect } from 'effect';
import {
  EquirectangularReflectionMapping,
  LoadingManager,
  type Object3D,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from 'three';
import { type Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

import type { AssetLoader, Lent } from './assetRegistry.ts';
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

type Gltf = { readonly scene: Object3D; readonly animations: Object3D['animations'] };

const nothing: ReadonlyArray<string> = [];

/** What lending an asset gives back: no parts or clips, and how to withdraw and free it. */
const plain = (release: () => void): Lent => ({ parts: nothing, clips: nothing, release });

/** Lends a colour texture (sRGB). */
const lentTexture = (store: ResourceStore, id: string, texture: Texture): Lent => {
  texture.colorSpace = SRGBColorSpace;
  const withdraw = store.lendTexture(id, texture);
  return plain(() => {
    withdraw();
    texture.dispose();
  });
};

/** Lends a model's scene, keeping its clips with it so a borrowed node can play them. */
const lentModel = (store: ResourceStore, id: string, gltf: Gltf): Lent => {
  gltf.scene.animations = gltf.animations;
  const withdraw = store.lend(id, gltf.scene);
  return {
    parts: namesIn(gltf.scene),
    clips: gltf.animations.map((clip) => clip.name),
    release: () => {
      withdraw();
      disposeModel(gltf.scene);
    },
  };
};

/** Lends an HDR panorama for `environment({ map })`: linear, mapped for reflection. */
const lentEnvironment = (store: ResourceStore, id: string, texture: Texture): Lent => {
  texture.mapping = EquirectangularReflectionMapping;
  const withdraw = store.lendTexture(id, texture);
  return plain(() => {
    withdraw();
    texture.dispose();
  });
};

/** Lends a font; fonts hold no GPU resources, so withdrawing the loan frees them. */
const lentFont = (store: ResourceStore, id: string, font: Font): Lent =>
  plain(store.lendFont(id, font));

type LoadAndLend = (store: ResourceStore, asset: Asset, manager: LoadingManager) => Promise<Lent>;

/** How each kind of asset loads, with a loading manager of its own, and is lent. */
const loadAndLend = {
  model: async (store, { id, url }, manager) =>
    lentModel(store, id, await new GLTFLoader(manager).loadAsync(url)),
  texture: async (store, { id, url }, manager) =>
    lentTexture(store, id, await new TextureLoader(manager).loadAsync(url)),
  environment: async (store, { id, url }, manager) =>
    lentEnvironment(store, id, await new HDRLoader(manager).loadAsync(url)),
  font: async (store, { id, url }, manager) =>
    lentFont(store, id, await new FontLoader(manager).loadAsync(url)),
} satisfies Record<AssetKind, LoadAndLend>;

/**
 * What the environment's registry loads scenes' assets with: three's loaders, each load
 * with a loading manager of its own, so aborting it cancels its requests (three's file
 * and image-bitmap loaders honour the manager's abort).
 */
export const assetLoader =
  (store: ResourceStore): AssetLoader =>
  (asset, signal) => {
    const manager = new LoadingManager();
    signal.addEventListener('abort', () => manager.abort(), { once: true });
    return loadAndLend[asset.kind](store, asset, manager);
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
    own(id, lentTexture(store, id, texture).release);
    return id;
  };

  const lendModel = (id: string) => (gltf: Gltf) => {
    const lent = lentModel(store, id, gltf);
    own(id, lent.release);
    const info: ModelInfo = { id, parts: lent.parts, clips: lent.clips };
    return info;
  };

  const lendEnvironment = (id: string) => (texture: Texture) => {
    own(id, lentEnvironment(store, id, texture).release);
    return id;
  };

  const lendFont = (id: string) => (font: Font) => {
    own(id, lentFont(store, id, font).release);
    return id;
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
    /**
     * Loads an equirectangular HDR panorama (`.hdr`, three.js's `HDRLoader`) and lends it
     * under `id` for `environment({ map: id })`. Succeeds with the id. Image panoramas
     * load with `loadTexture`; the scene maps them for reflection.
     */
    loadEnvironment: (id: string, url: string) => {
      const load = Effect.tryPromise({
        try: () => new HDRLoader().loadAsync(url),
        catch: (cause) => new AssetLoadError({ url, cause }),
      });
      return Effect.map(load, lendEnvironment(id));
    },
    /**
     * Loads a typeface JSON font (three.js's `FontLoader` format, as Drei's `Text3D` takes)
     * and lends it under `id`. Succeeds with the id.
     */
    loadFont: (id: string, url: string) => {
      const load = Effect.tryPromise({
        try: () => new FontLoader().loadAsync(url),
        catch: (cause) => new AssetLoadError({ url, cause }),
      });
      return Effect.map(load, lendFont(id));
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
