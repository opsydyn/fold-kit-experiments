# ADR-015: A scene asks for its assets; the environment loads, shares, cancels and frees them

- Status: Accepted (2026-10-20).
- Evidence: `packages/effect-three/test/assets.test.ts` (builders, `DuplicateAssetId`,
  list equality, scene files keeping assets and older files reading with none);
  `packages/effect-three-foldkit/test/assetRegistry.test.ts` (with a loader settled by
  hand: one load for two scenes, each told, a late asker told at once; the same list
  asked again changes nothing; a load no scene asks for is aborted and what it brings
  back anyway is freed unseen; the last scene to let go frees, once; a failure told to
  every asker and retried on asking afresh; an id held as something else is refused
  until it is let go, then loaded; changing what an id is; disposal);
  `packages/effect-three-samples/test/workshop.test.ts`; and headless Chromium on the
  promo's workshop: loaded, unloaded and reloaded, and with the robot's request held in
  the network, unloading during it ended the request (`net::ERR_ABORTED`) and the robot
  never appeared; reloading then loaded it.
- References: React Three Fiber's `useLoader` (`packages/fiber/src/core/hooks.tsx` at
  `d74622e`): results cached by loader and URL through `suspend-react`, one loader
  instance per loader class, `preload` and `clear` by hand, nothing cancelled and nothing
  freed for you; Drei's `useGLTF` (`src/core/Gltf.tsx` at `bf6f4ad`) is `useLoader` with
  `GLTFLoader`. three.js 0.186: `FileLoader` and `ImageBitmapLoader` fetch with the
  signal of their `LoadingManager`, whose `abort()` cancels their requests.

## Context

Assets loaded through Commands (`environment.assets.loadModel` and the rest) are the
application's to manage: it settles each into `AsyncData`, unloads it by hand, and has
no way to stop one under way, so a load finished after an unload still lends its asset.
Two scenes using one model load it twice or share it by convention. Roadmap 6 asks for
loading in the KeyedQuery style, cancelled when the Model stops asking.

## Decision

- **Assets are part of the description: `scene({ assets })`.** `modelAsset`,
  `textureAsset`, `environmentAsset` and `fontAsset` each name an id and a URL; nodes use
  the id as they did (`borrowed({ id })`, `map: id`, `environment({ map: id })`,
  `text({ font: id })`), and what is not lent yet is simply not drawn. Two assets with one
  id are refused with the rest of the description. Scene files keep them.
- **The environment holds them, keyed by id.** A registry per environment loads an asset
  the first time any scene asks for it, gives every scene that asks the same loan, and
  ends it when the last scene stops asking: a load under way is aborted (each has a
  loading manager of its own) and anything it returns is freed unseen; a loaded asset is
  withdrawn from the store and disposed.
- **Each scene hears about what it asked for:** `onAssetLoaded` (with a model's parts and
  clips), at once for one already loaded, and `onAssetFailed` with why. A failure stays
  while asked for; asking afresh (after letting go, or with another URL) tries again.
- **An id is one asset at a time.** A scene asking for an id another scene holds as
  something else is told it failed, and is given it once the other lets go.
- **Commands stay** for an application that wants to own an asset outright; use one way
  for any one id.

## Consequences

- An application's Model says which assets it wants, as it says everything else, and
  keeps their status (as `AsyncData`, say) from the two events; it never unloads.
- The cache lives in the environment, not the Model: GPU objects cannot be Model data.
  What the Model holds is the request and its answer, keyed by id, as KeyedQuery holds
  data by key.
- A texture loaded through `TextureLoader` uses an image element, which three cannot
  abort: its request runs to the end, and the texture is dropped.
- Reconciling every frame's description is cheap: the same list asks for nothing new.
