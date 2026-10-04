# Promo Live Line Implementation Plan

> Use superpowers:executing-plans in the existing worktree. Preserve uncommitted v1 changes.

**Goal:** A live line example with matching code and runnable exports.
**Architecture:** Astro shell; FoldKit model/update/view owns controls. Build-time
source collection feeds the code viewer and project template. Export settings
are a snapshot of the same chart state.
**Tech Stack:** Astro 7.1.1, FoldKit 0.165.0, Effect 4.0.0, Foldkit Viz, fflate, StackBlitz SDK.
**Spec:** `docs/superpowers/specs/2026-10-04-promo-live-line-design.md`

## Global Constraints

- Route `/examples/line/`; five values 0–100, Y maximum 100–200.
- Interpolation smooth/linear/step; initial values 10,45,23,88,67; Y maximum 100.
- Pure geometry imports; browser side effects in Commands; no arbitrary editor.
- Exact maintained source and current settings in exports; standalone Vite project.
- Both themes, mobile and keyboard access; no deployment or publication.

## Review Focus

- Invalid numeric control payloads cannot poison SVG coordinates.
- Copy or download failure must produce visible feedback and permit retry.
- Export must capture clicked settings and include every local import.
- Reload/deep links and no-JavaScript visits still give a usable explanation.
- Mobile source code scrolls inside its panel, rather than widening the page.

### Task 1: Chart and state contracts

**Files:** `apps/promo/src/examples/line/{chart,settings}.ts`, `test/live-line.test.ts`.
**Interfaces:** `Settings` owns curve, values, yMax; `chartGeometry(settings)` returns
path, points, x/y ticks; `changeValue(settings,index,value)` and `changeDomain` reject
invalid payloads. `settingsSource(settings)` emits an executable module.

- [x] Test known coordinates, interpolation changes, domain changes, invalid values
      and executing settingsSource with modified values. Confirm RED before implementation.
- [x] Implement pure helpers using existing scale and line primitives; confirm GREEN.

### Task 2: Island and runnable exports

**Files:** `examples/line/{main,message,command,app,project}.ts`, `chart.css`,
`lib/line-project.ts`, `pages/downloads/line-template.json.ts`, `pages/examples/line.astro`.
**Interfaces:** main exports Model, Message, init, update, view; project files are
`Record<string,string>`, `projectFiles(template,settings)` replaces settings.ts.

- [x] Test exported ZIP settings by extracting and executing the module; confirm RED.
- [x] Implement controls, source viewer, reset and commands with explicit result states.
- [x] Add static project template with compiled vendor modules and a Vite entry point.
- [x] Build/install/typecheck the exported project in a temporary directory; expect exit 0.

### Task 3: Integration and qualification

**Files:** promo config/package/README, examples page, docs page, root lint config.

- [x] Add Astro FoldKit integration and entry links to the live example.
- [x] Run focused and root checks, typecheck, workspace tests and build; all exit 0.
- [x] Browser-check controls, matching source, reset, themes, mobile and export actions.
- [x] Independent review and corrections; report preview and exact verification.

## Execution evidence

Baseline root check and typecheck passed. npm verification showed local Viz 0.9.0
versus published 0.8.0 and local Astro integration 0.7.0 versus published 0.6.0.
Standalone exports therefore include the compiled geometry modules they use.

Final qualification (2026-10-04):

- Root `bun run check`, `bun typecheck`, `bun run test` and `bun run build`
  all exited 0; frozen-lockfile installation made no changes.
- Promo has 14 passing tests. Known-coordinate, numeric rejection, settings-module
  execution and ZIP round-trip tests began RED and passed after implementation.
- Review found one action-state race: selecting a source or resetting re-enabled
  export buttons during an active Command. A RED/GREEN regression now proves
  Pending is preserved and repeated actions produce no second Command.
- Browser checks passed for keyboard values/domain, three curves, live source,
  reset, copy success feedback, actual ZIP download, desktop dark and mobile light.
  At 390px, document width was 390px while long code scrolled within a 348px panel.
- The actual browser ZIP contained 25 files and captured step interpolation,
  first value 100 and domain 110. It passed standalone npm typecheck/build.
  A separate npm install completed without peer overrides and reported no
  vulnerabilities. The standalone Vite app hydrated and keyboard changes updated
  its geometry/source without console errors.
- StackBlitz received the generated project, installed dependencies and started
  the preview. Step interpolation and keyboard value changes worked in its iframe.
- The generated HTML includes a no-JavaScript explanation with static quick-start
  and curve-comparison links. This fallback was inspected in build output.

Implementation boundaries:

- Standalone export uses Vite 8.3.1 to match the FoldKit Vite plugin's peer range;
  Astro continues to host the promo. Node 22.12+ is documented. fflate is 0.8.3.
- Source metadata is separate from the runtime model so Astro can collect files
  without importing the FoldKit runtime during prerender.
- Astro 7 builds static pages in a `prerender` Vite environment; its environment
  reconstruction does not retain the FoldKit plugin's `ssr` noExternal setting.
  A promo-local `configEnvironment` hook bundles FoldKit singleton packages for
  prerender. Root and promo production builds confirm this configuration works.
- Changes remain uncommitted in the existing managed promo worktree. No npm
  publication, hosting configuration or deployment was performed.
