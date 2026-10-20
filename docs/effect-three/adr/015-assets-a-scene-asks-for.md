# ADR-015: A scene asks for its assets; the environment loads, shares, cancels and frees them

- Status: Accepted (2026-10-20).
- Evidence: `packages/effect-three/test/assets.test.ts` (builders, `DuplicateAssetId`,
  list equality, scene files keeping assets and older files reading with none);
  `packages/effect-three-foldkit/test/assetRegistry.test.ts` (with a loader settled by
  hand: one load for two scenes, each told, a late asker told at once; the same list
  asked again changes nothing; a load no scene asks for is aborted and what it brings
  back anyway is freed unseen; the last scene to let go frees, once; a failure told to
  every asker and retried on asking afresh; an id held as something else is refused
  until it is let go, then loaded; changing what an id is; disposal; and for levels,
  each shown as it arrives if finer, a coarser one arriving late freed unseen, coarser
  loads cancelled once the finest is shown, a coarser failure skipped, the finest
  failing while a coarser stays shown, and levels changing what an asset is);
  `packages/effect-three-samples/test/workshop.test.ts`; and headless Chromium on the
  promo's workshop: loaded, unloaded and reloaded, and with the robot's request held in
  the network, unloading during it ended the request (`net::ERR_ABORTED`) and the robot
  never appeared; reloading then loaded it. With the full robot and floor held back
  four seconds, the coarse ones showed first ("Low detail, sharpening") and the full
  ones replaced them as they came, the robot's clip playing on; unloading meanwhile
  ended the full robot's request (`net::ERR_ABORTED`).
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

## Since: levels of detail

Roadmap 6 also asks for level of detail as a stream of descriptions. An asset may list
coarser `levels` (URLs, coarsest first) before its own URL, the finest:
`modelAsset({ id: 'robot', url: 'robot.glb', levels: ['robot-low.glb'] })`.

- **Every level loads at once.** A coarse level is small and comes first; waiting for
  it before starting the finest would only delay the finest.
- **Each is shown as it arrives if it is finer than what is shown,** lent under the
  asset's id before the coarser loan is withdrawn, so nodes using the id swap without a
  frame of nothing (a model's clip keeps playing). A coarser level arriving after a finer
  one is freed unseen. Once the finest is shown, coarser loads still under way are
  aborted.
- **Scenes hear each level shown:** `onAssetLoaded` carries `level` (0 for the
  coarsest, `levels.length` for the finest) and `final`. A coarser level failing is
  skipped; only the finest failing is `onAssetFailed`, and whatever coarser level is
  shown stays. A scene asking later hears both.
- **Levels are part of what an asset is:** the same id with other levels is another
  asset, loaded afresh.

The stream is of loans, not of descriptions: the description names every level once,
and what changes as they arrive is what the id is lent as. A Model that wants to say
"coarse only for now" lists fewer levels, or another URL.
