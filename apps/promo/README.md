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

The default port is **4322**. For the review server, run `bunx astro dev --host 127.0.0.1 --port 4321` from `apps/promo`. Build output is `apps/promo/dist/`.

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

Exports include the complete emitted runtime and declaration closure for geometry, themes, FoldKit layers and their primitives from this checkout, so they
run without workspace access or an unpublished npm version. Unzip, run
`npm install`, then `npm run dev` (Node 22.12+), or use Bun. StackBlitz receives the
example project when the visitor chooses that action. The exported page follows
the system colour preference; the promo retains its saved theme toggle.

The build generates `/downloads/line-template.json`; raw code and template
assembly stay at the Astro build boundary. Browser effects run in FoldKit Commands.
The Edit live tab embeds the same maintained project; see its session behaviour below.

## Live histogram example (v2)

`/examples/histogram/` groups one of two fixed 40-value illustrative samples on
an explicit 0–100 domain. The bin-count slider selects exactly 2–20 intervals.
The chart shows counts and rescales its Y-axis; interval boundaries are described
in SVG titles and its accessible summary. Both endpoints are retained.

Source, copy, reset and exports follow the line example. `settings.ts` captures
the chosen dataset and bin count, while `data.ts` contains both sample arrays.
The static `/downloads/histogram-template.json` uses shared project scaffolding
and includes the complete public-module dependency closure. Each downloaded example owns its
FoldKit application files so it runs independently of the monorepo.

## Interactive scatter

`/examples/scatter/` maps 24 illustrative points through two linear scales. Compare Group A and Group B, widen either domain from 100 to 200, and inspect points by hover, tap, the labelled selector or arrow/Home/End keys at the single chart focus stop. Filtering out the inspected point clears the selection.

The source viewer, downloaded Vite project and StackBlitz project preserve the current group, domains and inspected point. Geometry uses `chart/cartesian`; keyed Group A circles and Group B squares retain identity when filtered. The Model and Messages own all interaction state. The standalone export includes the same layers and themes.

## Edit live

The line example has Controls and Edit live tabs. The editor loads on first selection, captures the current controls, and runs the same standalone Vite project in an embedded StackBlitz editor. Tab switches keep its session alive. Arrow keys, Home and End navigate the tabs.

Code edits belong to the editor session. The running FoldKit Model survives hot reload; reload the preview to apply edited initial defaults. CSS and view edits update the live preview. Restart from controls replaces those edits with a fresh copy of the current control settings. Use StackBlitz's project actions to keep code edits; the promo's Copy file, Download project and Open in StackBlitz actions use the control settings. Standalone exports hide the embedding controls to avoid recursive editors.

The embed is a FoldKit Mount resource: the runtime owns the host, the SDK owns only its children, and unmounting clears the iframe. Failed connections provide a retry and the existing external StackBlitz action. StackBlitz and package installation require network access and a browser supported by WebContainers.

Static hosting must send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`. Astro dev and preview send these through `server.headers`. The build includes `public/_headers` for platforms supporting that convention; on other hosts, configure the equivalent response headers explicitly. The embed delegates isolation to the StackBlitz origin, including its initial POST navigation.

## Composition and source capture

All three live examples use the public `chart/cartesian`, `chart/theme` and
optional `foldkit/cartesian` APIs. Measured width is a serialisable Model field,
reported by a scoped Mount ResizeObserver. Axes use 12px labels and fewer ticks
on narrow plots. Theme paints use semantic CSS properties, separate opacity and
stable keyed styles. Line layers include a reference series and target annotation;
scatter supplies a replacement tooltip. Native details panels expose raw values.

The source viewer includes shared frame and measurement files. Source copy and
ZIP/StackBlitz generation capture current controls; editor code belongs to its own
persistent session. ZIP exports vendor the compiled dependency closure and shared
import aliases. Tests install, typecheck and build each project in an OS temporary
directory and render the packed optional adapter under Bun and Node.

These composition APIs are unreleased workspace changes. No npm publication or
site deployment is implied by local build and browser qualification.
