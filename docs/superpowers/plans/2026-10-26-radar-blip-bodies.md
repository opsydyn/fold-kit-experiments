# 3D Radar Blips: Phase One

**Status:** approved 2026-10-26 with the proposed choices and implemented. See "As built" at the end.

**Goal:** give each radar blip character that also carries information, using only data
the radar already has: category, ring and relationships. Phase two (movement, freshness,
confidence, live signals) needs new data and is not part of this plan.

**Base:** a branch from `main` once PR #63 (calmer edges and label placement) has merged,
since this builds on its placement and focus rules.

## 1. A body per category

Today category is shown by colour alone, which a colour-blind reader can't rely on.
Each category gets its own **shape and surface**, still tinted with its category colour:

| Category               | Body          | How                                                                     |
| ---------------------- | ------------- | ----------------------------------------------------------------------- |
| Techniques             | Icy glass     | smooth `sphere`, `physical` with transmission, low roughness, clearcoat |
| Tools                  | Faceted metal | low-poly `sphere` (8 × 6 segments), `flatShading`, metalness about 0.6  |
| Platforms              | Rocky world   | mid-poly `sphere` (12 × 8), `flatShading`, high roughness               |
| Languages & Frameworks | Ringed giant  | smooth `sphere` plus a thin tilted `torus` ring                         |

- **Same footprint:** every body keeps today's radius, so position (ring) and size
  (pinned) keep their meanings, and label placement's blip obstacles are unchanged.
- **States:** each body has a lit variant for hover and pin, as now.
- **Structure:** each blip becomes a `group` keyed `blip:<id>` and marked
  interactive, with its parts as children (`blip:<id>:body`, `blip:<id>:ring`, …).
  `idOfBlip` reads the id from any part's key, so hover and click still resolve to the
  entry.
- **Legend:** the category legend names the body beside each swatch ("Techniques ·
  glass"), so the shapes are explained in HTML too.

## 2. Moons for relationships

- **Count:** each blip gets one small moon per relationship, so how connected an entry
  is shows at a glance (FoldKit two, Bun none).
- **Colour:** each moon takes its relationship type's colour, tying it to the edges and
  hinting at the types before you focus.
- **Motion:** moons orbit the body on a shared `spin` group. Each blip gets a fixed tilt
  and phase from its id, so they don't move in lockstep.
- **Reduced motion:** the Foldkit mount already freezes scene time under
  `prefers-reduced-motion`, so orbits stop and moons hold still.
- **Draw cost:** about 32 moons in total, from one shared geometry and five shared
  materials.

## 3. Detail by distance

Each blip group uses `detailed({ distances: [0, nameDistance, far] })`, matching the
label rules:

| Camera distance to blip   | Shows                                         |
| ------------------------- | --------------------------------------------- |
| within `nameDistance` (7) | full body, ring and moons                     |
| to `far` (about 11)       | the body only                                 |
| beyond                    | a small softly glowing dot in category colour |

From the home camera (12 units out) the radar stays a calm field of glowing points.
Planets and moons reveal themselves as you zoom, the same way names do.

## 4. Starfield and focus glow

- **Stars:** a faint, desaturated `stars` field well beyond the zoom limit (radius 30,
  low count, fading with depth), for depth without meaning.
- **Glow:** `bloom` with a threshold of 1, as in the marbles sample. Only the focused
  body's emissive surface goes above 1, so it glows softly and nothing else does.
  Labels and edges stay below the threshold.

## Files

- **`radar/bodies.ts`** (new): body geometry and material definitions per category,
  moon layout (offsets, tilt and phase from an id hash), and the level-of-detail
  distances. Pure.
- **`radar/scene.ts`:** blip groups, moons, stars and render settings; resources for
  the new shared geometries and materials.
- **`radar/model.ts`:** `idOfBlip` reads child keys.
- **`radar/view.ts`:** legend body names.

## Verification

- **`bun:test`:**
  - each category's body uses its geometry and material;
  - moon count equals the entry's relationships, coloured by type;
  - moon offsets are stable for an id and differ between ids;
  - level-of-detail distances match the label thresholds;
  - `idOfBlip` resolves child keys and rejects others;
  - the starfield and bloom are present;
  - a real scene-graph reconcile;
  - `previewSvg` still draws.
- **Existing radar tests** still pass, including placement and relationships.
- **Repo checks:** `bun run check`, `bun typecheck`, `bun run test`.
- **Chromium:**
  - home, zoomed in and pinned views at desktop and 375px;
  - hover and click on each body type, including the ringed giant;
  - glass bodies readable on the dark stage;
  - frame rate still smooth with glow on.

## Risks

- **Glass cost:** transmission adds a render pass. If glass is slow or looks wrong under
  WebGPU, I'd fall back to a clearcoat translucent surface that still reads as glass.
- **Glow spill:** if bright labels catch the glow, raise the threshold or dim the label
  ink.
- **Clutter:** moons and rings appear only up close, and the pinned blip's moons orbit
  inside the area label placement already keeps clear.

## Out of scope

Phase two signals (movement trails, freshness glow, confidence cores, live data), a
Caution-ring pulse, and any push or PR without a separate ask.

## Open questions

1. Moons in their relationship type's colour (proposed), or one neutral colour?
2. Glass for Techniques, if it holds up (proposed), or translucent clearcoat from the
   start?
3. Starfield always on (proposed), or behind a toggle?

## As built

Where the implementation differs from the plan above:

- **No bloom.** The canvas is transparent so the page's stage shows through, and the
  bloom pass mishandled that: the faint shells came out as a bright, washed disc. The
  focused blip instead wears a **halo**, a faint translucent sphere of its own colour
  just outside the body, drawn in the scene with no post-processing pass.
- **A still starfield.** effect-three's `stars` always twinkle, which keeps the scene
  drawing every frame. The radar uses 700 fixed `points` from a seeded generator, so an
  idle radar renders only when something changes.
- **Moons only up close.** Orbiting moons also keep the scene drawing, so a blip has
  moons only while it is within the name distance. From home nothing orbits; zoom in
  and the moons appear and turn.
- **Same-size dots.** Distant dots keep the body's radius, so a change of form never
  reads as a change of size (size means pinned).
- **Less metal.** With no environment map to reflect, a mostly metallic surface rendered
  nearly black, so faceted Tools are only partly metallic (0.3).
- **Glass held up** in Chromium, so Techniques use transmission as planned. WebGPU and
  Safari are not checked.
- **Tests:** 76 radar tests in the samples package (8 new).
