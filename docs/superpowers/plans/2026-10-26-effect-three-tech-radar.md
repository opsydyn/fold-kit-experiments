# 3D Tech Radar Sample Plan

**Status:** approved 2026-10-26 with the recommended choices (move and share,
translucent shells, `apps/web` only) and implemented. See "As built" at the end.

**Goal:** A `radar` sample in `@opsydyn/effect-three-samples` that draws the
functional & AI radar's 32 entries as a real 3D scene you can orbit, shown at
`/effect-three/radar` in `apps/web`.

**Why 3D isn't decoration here:** the 2D radar already models a sphere.
`layoutEntries` gives each entry a longitude (its category's 90° sector) and a
latitude (±22°), and `shellFractions` gives its ring a radius (adopt 0.4 →
caution 1.0). The 2D app projects that sphere onto SVG. The 3D sample draws the
same model directly, so every axis keeps the meaning it already has.

**Stack:** existing effect-three 0.6.0, the Foldkit adapter, troika labels,
FoldKit 0.167.0, Effect 4.0.0. No new dependencies; manifests and the lockfile
are unchanged apart from one `exports` entry.

## Reuse boundary (decision needed)

`effect-three-samples` cannot import from `apps/web`, and the radar's data and
layout live in `apps/web/src/apps/functional-ai-radar/`.

**Recommended:** move the domain pieces into the samples package and point the
2D app at them.

- Move `data.ts` and `fixture.ts` into `packages/effect-three-samples/src/radar/`.
- Split `geometry.ts`. The renderer-neutral part (`shellFractions`, sector
  starts, `layoutEntries`, `filterPositions`, `countRings`, `RadarFilters`)
  moves to `src/radar/layout.ts`. The 2D projection (`projectRadar`, globe
  clipping, `RadarView`) stays in the web app.
- The 2D app imports through the existing `./src/*` export
  (`@opsydyn/effect-three-samples/src/radar/layout`). `apps/web` already
  depends on the package.
- Tests follow the code: data and layout tests move to `bun:test` in
  `packages/effect-three-samples/test/`, and projection tests stay in Vitest in
  the web app.

**Alternative:** copy the three files. It's faster and leaves the 2D radar
untouched, but the two copies will drift.

## Files

Sample (`packages/effect-three-samples/src/radar/`, shaped like `bars/`):

| File                                  | Role                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `data.ts`, `fixture.ts`, `layout.ts`  | Moved from the 2D app (see above)                                       |
| `space.ts`                            | Pure: `RadarPosition` + ring → `[x, y, z]`; shell radius in scene units |
| `model.ts`, `message.ts`, `update.ts` | Filters, hover, selection, orbit camera, theme, scene lifecycle         |
| `scene.ts`                            | `sceneFor(model)`: shells, sector guides, blips, labels, lights, camera |
| `view.ts`, `main.ts`                  | Scene mount with filter controls, entry list, details panel and readout |

Wiring: an `./radar` export in `package.json`, plus
`apps/web/src/apps/effect-three-radar/app.ts`,
`apps/web/src/pages/effect-three/radar.astro` and a link from the effect-three
index page. All copied from the `bars` wiring.

## Scene

- **Shells:** four concentric spheres with low opacity, one per ring, using a
  translucent standard material. A brighter equator `ring` on each shell helps
  you read depth.
- **Sector guides:** four meridian `line`s on the outer shell mark the
  category boundaries. Category names are troika `label`s at each sector's
  `categoryCenter`.
- **Blips:** one shared `sphere` geometry. The material is set per category,
  with a lighter `:lit` variant for the hovered or selected blip, as in `bars`.
  Keys are entry ids. Filtered-out blips ease to scale 0 and go
  `interactive: false` rather than disappearing.
- **Selection:** the selected blip gets a troika label with its name.
- **Camera:** the orbit lives in the Model, with a Reset view button using
  `fitCamera`. No auto-rotate, so reduced motion needs no special case. The
  scene only claims gestures inside the canvas.

## Events and interaction

- **Scene events:** `onPointerEnter`, `onPointerLeave`, `onClick` and
  `onPointerMissed` become `HoveredBlip`, `LeftBlip`, `ClickedBlip` and
  `ClickedEmptySpace`, mirroring `bars`.
- **HTML controls:** a search box, a category select and ring toggles (with
  counts from `countRings`) send `UpdatedQuery`, `SelectedCategory` and
  `ToggledRing`.
- **Entry list:** a numbered list of the visible entries
  (`displayNumber`). Clicking an entry selects the same blip, so everything
  works without the canvas.
- **Rules:** if a filter hides the selected entry, the selection clears. A
  dataset `Failure` shows its reason instead of the scene.

## Verification

- **`bun test ./test/radar.test.ts`:**
  - the moved data and layout tests;
  - `space`: every blip lies on its ring's shell radius, and the four
    categories land in distinct sectors;
  - `update`: filtering, selecting, clearing, and a selection cleared when a
    filter hides it;
  - the scene through `createSceneGraph` (kernel, no browser): keys are the
    entry ids and unique, filtered blips are not interactive, and the selected
    blip uses the lit material;
  - a `previewSvg` smoke render.
- **The 2D radar's Vitest suite** still passes after the split.
- **Repo checks:** `bun run check`, `bun typecheck`, `bun run test`.
- **Browser** (`bun dev`, `/effect-three/radar`): hover, click, empty-space
  clear, filters, list selection, orbit and reset, light and dark themes, 375px
  width, no console errors. Chromium only. Physical devices, Safari and screen
  readers stay unverified.

## Out of scope

Adding the sample to `three-promo`, changes to the effect-three packages,
physics, XR, new dependencies, and any push or PR without a separate ask.

## Open questions

1. Reuse boundary: move and share (recommended), or copy?
2. Shells: translucent spheres (recommended), or wireframe guides only?
3. Add the sample to `three-promo` now, or later?

## As built

Where the implementation differs from the plan above:

- **Exports:** the 2D app imports `@opsydyn/effect-three-samples/radar/data`,
  `/radar/fixture` and `/radar/layout`, three explicit `exports` entries. The
  `./src/*` wildcard works under Vite but not under `astro check`, because its
  targets have no `.ts` extension.
- **Re-exports:** the 2D `geometry.ts` re-exports the shared layout, so its
  other modules keep importing from `./geometry`.
- **Reset view:** goes back to the home camera rather than calling
  `fitCamera`, which needs the stage's pixel size. Turn left and Turn right
  buttons orbit 30° for keyboard users, and choosing a list entry turns the
  camera to face its blip.
- **Theme:** no theme subscription. In `apps/web` the stage is always dark
  (`--surface` falls back to `#12121f`), and the blips use the 2D radar's
  category colours, so neither needs to follow the page theme.
- **Labels:** category and ring names, plus the hovered or pinned entry's
  name, are troika labels that always face the camera (`billboard()`).
- **Shells:** unlit `basic` with `depthTest: false`, not a lit standard
  material. Translucent shells that write depth hid the inner ring labels and
  equators in the browser.
- **Stage:** a new `e3-stage-square` class keeps the stage square on narrow
  screens (capped at the tall stage's height), and the camera stands 12 units
  out, so the sphere and its labels fit at 375px wide.
- **Tests:** 55 radar tests still run; 25 of them moved into the samples
  package (23 data, 2 layout). The new `test/radar.test.ts` adds 14.
