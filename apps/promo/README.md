# @opsydyn/promo

The Foldkit Viz promo site, implemented from the approved light and dark
visual-studio mockups. Static Astro pages render SVG geometry from workspace
imports of `@opsydyn/foldkit-viz`; the site does not depend on demo internals.

## Run

From the monorepo root:

```sh
bun install
bun run dev:promo
bun run --filter @opsydyn/promo build
bun run --filter @opsydyn/promo preview
```

The default port is **4322**. Build output is `apps/promo/dist/`.

## Pages

- `/`: landing, six chart previews and a hero with keyboard/hover month totals.
- `/examples/`: larger examples, source links and selectable curve interpolation.
- `/docs/`: installation, quick start and architecture guidance.

Chart datasets are illustrative. Geographic boundaries come from Natural
Earth through the ISC-licensed `world-atlas` package. Inter is self-hosted
through `@fontsource-variable/inter` and licensed under the SIL OFL.

Theme follows the system unless the visitor saves a choice. Local storage
failures do not prevent toggling. Layouts reflow for mobile, keyboard focus
remains visible and reduced-motion preferences are respected.

## Verify

```sh
bun run --filter @opsydyn/promo test
bun run --filter @opsydyn/promo typecheck
bun run check
```

Root `bun run build` includes this app. No hosting adapter, public site URL or
deployment is configured.

## Live line example (v2)

`/examples/line/` embeds a FoldKit island with interpolation, five point-value
sliders, a Y-axis domain control and reset. Its code viewer shows the maintained
example files; `settings.ts` follows the current controls. Copy uses the browser
clipboard with visible failure feedback. Download and Open in StackBlitz capture
current settings in a complete Vite/FoldKit project.

Exports include the compiled scale/line/path subset from this checkout, so they
run without workspace access or an unpublished npm version. Unzip, run
`npm install`, then `npm run dev` (Node 22.12+), or use Bun. StackBlitz receives the
example project when the visitor chooses that action. The exported page follows
the system colour preference; the promo retains its saved theme toggle.

The build generates `/downloads/line-template.json`; raw code and template
assembly stay at the Astro build boundary. Browser effects run in FoldKit Commands.
This first slice has controls and a source viewer; editable source is a later step.

## Live histogram example (v2)

`/examples/histogram/` groups one of two fixed 40-value illustrative samples on
an explicit 0–100 domain. The bin-count slider selects exactly 2–20 intervals.
The chart shows counts and rescales its Y-axis; interval boundaries are described
in SVG titles and its accessible summary. Both endpoints are retained.

Source, copy, reset and exports follow the line example. `settings.ts` captures
the chosen dataset and bin count, while `data.ts` contains both sample arrays.
The static `/downloads/histogram-template.json` uses shared project scaffolding
and includes the compiled scale/bin modules. Each downloaded example owns its
FoldKit application files so it runs independently of the monorepo.

## Interactive scatter

`/examples/scatter/` maps 24 illustrative points through two linear scales. Compare Group A and Group B, widen either domain from 100 to 200, and inspect points by hover, focus, tap or the labelled selector. Filtering out the inspected point clears the selection.

The source viewer, downloaded Vite project and StackBlitz project preserve the current group, domains and inspected point. Geometry uses the existing `foldkit-viz/math/scale` primitive; the model and messages own all interaction state. The standalone export includes the compiled scale module.
