# Keyed chart comparison: host and export qualification

Date: 2026-10-08. Task 4 baseline: `6e2afbd`, clean managed
`keyed-chart-comparison` worktree.

## Scope

The `/comparison` Astro route contains one `client:load` island under the existing
Layout, reached from Charts. Its literal `lazyApp` loader and the
`Charts/Comparison` Workbench Story use the same maintained application exports.
Host initialisation ignores Astro props and delegates to the state initializer
with deterministic `initialSettings`. Plain `comparison.css` is imported by the
shared view; no additional CSS compiler or runtime was introduced.

## Automated evidence

- Focused RED: `bun run --filter @opsydyn/web test src/apps/comparison/host.test.ts`
  exited 1 before host implementation: four failing assertions for the absent
  application configuration, Story, and route. Log: `/tmp/comparison-task-4-red.log`.
- Focused GREEN: the same command exited 0, four tests passing. Final static-import
  test log: `/tmp/comparison-task-4-green-final.log`.
- Full web suite: `bun run --filter @opsydyn/web test` exited 0, 202 tests in
  36 files. Log: `/tmp/comparison-task-4-web-tests.log`.
- Web production build: `bun run --filter @opsydyn/web build` exited 0, no warnings
  observed. Log: `/tmp/comparison-task-4-web-build.log`.
- Storybook production build: `bun run --filter @opsydyn/web build-storybook`
  exited 0. Vite warns that some minified chunks exceed 500 kB; this is not a
  failed build or browser evidence. Log: `/tmp/comparison-task-4-storybook-build.log`.
- Final workspace gates ran sequentially: `bun run check` exited 0;
  `bun typecheck` exited 0 (zero errors, warnings or hints);
  `NPM_CONFIG_CACHE=/private/tmp/foldkit-npm-cache bun run test` exited 0 with
  484 tests passing: Astro integration 77, Viz 168, promo 37, web 202.
  Logs: `/tmp/comparison-task-4-check.log`,
  `/tmp/comparison-task-4-typecheck-final.log`, `/tmp/comparison-task-4-tests.log`.
- `git diff --check` exited 0. Storybook's generated index includes
  `charts-comparison--workbench` with `./src/stories/comparison.stories.ts`.

The happy-dom host test exercises actual application exports and runtime:
ordered accessible panel names; add both types to four and disabled fifth;
keyboard histogram inspection selecting two data points with four highlighted
marks across two scatters; reorder retaining keyed nodes and inspection; source
removal clearing overlays; remove-all and re-add as Scatter 5; no further update
calls or DOM changes after disposal. The Story test mounts via the existing
helper and adds a real panel. Source assertions cover single-island wiring and
Charts navigation, not live hydration or runtime multiplicity.

## Browser acceptance: explicitly pending

The controller owns live browser QA using native CUA in a dedicated Firefox
Developer Edition tab. No connected browser provider was available. The
controller initially reported that CUA `getApp` found the Mac locked and
auto-unlock failed. The Mac is now unlocked. The controller performed the
standalone observations below, then stopped after unrelated navigation and an
invalidated CUA binding. Further UI QA is pending exclusive Firefox access.
The lock is no longer a blocker. No bypass or unlock
attempt was made by this implementer. Task 4 host observations are still awaited;
the supplied standalone observations are recorded below. Controller QA remains
separate from the HTTP smoke below.

All Task 4 browser gates remain pending:

- [ ] Desktop default panels; readable axes, controls, count and data alternative.
- [ ] Add both types to four and blocked fifth in the live Astro host.
- [ ] Reorder with active inspection and retained keyed-control focus.
- [ ] Source removal clears the overlay while local state persists.
- [ ] Remove all, recover focus to add, and re-add with a monotonic ID.
- [ ] Keyboard and pointer ranges agree; visible count includes all matches.
- [ ] Pointer hit testing after reorder, scroll and resize.
- [ ] 390px single-column layout without horizontal overflow or clipped text.
- [ ] Distinct local focus and linked-highlight styles; reduced motion usable.
- [ ] No duplicate runtime or console errors; host teardown observed.

Use `.superpowers/sdd/2026-10-08-keyed-chart-comparison/browser-checklist.md`.
Record controller-supplied observations separately before final task review.
Automated DOM tests do not qualify real layout, native input, VoiceOver, physical
devices, or browser hydration. Promo and standalone live acceptance are in
progress under the controller, currently paused pending exclusive browser access. No push, merge, publication or deployment occurred.

## Controller preview handoff

From this worktree, choose an unused port (replace `4337` if occupied):

```sh
bun run --filter @opsydyn/web preview --host 127.0.0.1 --port 4337
```

Open `http://127.0.0.1:4337/comparison` and verify the Charts link at
`http://127.0.0.1:4337/charts`. The production build is already present.
The configured Cloudflare adapter uses a local preview; it may require localhost
permissions outside the sandbox. Stop only this temporary server after QA.
This command was verified against the installed preview script/adapter, not
executed; no server is being left running.

## Task 5: same-source promo and standalone exports

Baseline: `70b7c7b`, clean managed worktree. The promo wrapper owns export/source
state and folds the maintained workbench with `foldChild` and `foldChildInit`.
It does not duplicate the reducer, panel matching, chart math or runtime.
Settings are captured when Commands are created. The export replaces only
`src/web/src/apps/comparison/initial-settings.ts`; schema/validation stays in
the unchanged captured `settings.ts`.

The TypeScript-parser collector follows static imports and re-exports under
the two approved app roots, preserves apps-relative paths, includes plain CSS,
and rejects missing, escaping, excluded and symlink-escaping sources. Collection
also runs after Astro relocates its prerender chunk. The existing Viz vendor
walker includes consumed subpaths and compiled dependencies. No package API,
runtime, lockfile or dependency-version changes were made.

### RED/GREEN and automated gates

- RED: `bun run --filter @opsydyn/promo test test/comparison-source.test.ts test/comparison-export.test.ts test/comparison-state.test.ts`
  exited 1: 37 existing tests passed and four new files failed to load the absent
  comparison contracts. The workspace script also discovers the standalone test.
  Log: `/tmp/comparison-task-5-red.log`.
- GREEN: the same command with `NPM_CONFIG_CACHE=/private/tmp/foldkit-npm-cache`
  exited 0: 49 tests, zero failures. Log: `/tmp/comparison-task-5-green.log`.
  Twelve new tests cover source identity/path safety, relocated collection,
  exact `[2,3,1]` snapshots with linking off and counter 4, transient-state
  exclusion, independent exports, duplicate-ID rejection, pending guards,
  actual clipboard delivery, a delayed template fetch, failure/retry, delayed
  keyed child completion, shared view and suppressed standalone export controls.
- Relocation regression RED/GREEN: `bun test test/comparison-source.test.ts`
  from `apps/promo`, exits 1 then 0. Logs:
  `/tmp/comparison-task-5-relocated-{red,green}.log`. The initial Astro build
  reproduced the wrong source root; the final build includes both the promo
  route and download JSON successfully.
- Final workspace lint/format: `bun run check`, exit 0, no lint warnings.
  Log: `/tmp/comparison-task-5-check.log`.
- Final typecheck: `bun typecheck`, exit 0, zero errors/warnings/hints.
  Log: `/tmp/comparison-task-5-typecheck.log`.
- Final tests: `NPM_CONFIG_CACHE=/private/tmp/foldkit-npm-cache bun run test`,
  exit 0, **496 passing** (Astro 77, Viz 168, promo 49, web 202).
  Log: `/tmp/comparison-task-5-tests.log`.
- Final app builds: `env -u FOLDKIT_BUILD_ID bun run build`, exit 0, no warnings
  observed. Log: `/tmp/comparison-task-5-build.log`.
- Final Storybook: `bun run --filter @opsydyn/web build-storybook`, exit 0.
  Existing >500 kB warning remains (axe 579.43 kB, iframe 812.55 kB).
  Log: `/tmp/comparison-task-5-storybook.log`. No chunk-warning remediation or
  Task 4 fixed-50ms disposal-wait changes belong to Task 5.

The final tests and builds were awaited sequentially. An earlier invalid run
overlapped tests with rebuilding package output and caused ten web import-resolution
failures. It is retained as `/tmp/comparison-task-5-tests-invalid-overlap.log`,
not used as qualification evidence. The complete isolated rerun passed.

### Standalone project and controller preview

The comparison test and all three existing line/histogram/scatter standalone
tests each generate an external temporary project, run
`npm install --no-audit --no-fund`, `npm run typecheck` and `npm run build`, and
remove their fixture. No `workspace:` dependency or dangling app alias remains.

A separate fixture is preserved at **`/private/tmp/comparison-task-5-preview`**
(`/tmp/comparison-task-5-preview` resolves to the same location on this Mac).
It contains 64 generated files plus installed dependencies and a production
build. Its exact initial settings are:

```json
{
  "panels": [
    { "id": 2, "kind": "histogram" },
    { "id": 3, "kind": "scatter" },
    { "id": 1, "kind": "scatter" }
  ],
  "linkInspections": false,
  "nextPanelId": 4
}
```

Preserved-fixture install, typecheck and build all exited 0. Logs are
`/tmp/comparison-task-5-preview-{install,typecheck,build}.log`. A brief implementer
preview on port 4389 returned HTTP 200 for HTML, JavaScript and CSS; log:
`/tmp/comparison-task-5-preview-http.log`. That server was stopped. This is
transport/asset evidence only, not browser execution or layout qualification.

The controller used native Firefox for the observed subset, then stopped its
preview session (31404) after unrelated navigation invalidated the CUA binding.
The following command restarts the unchanged fixture once exclusive access is available:

```sh
cd /private/tmp/comparison-task-5-preview
npm exec -- vite preview --host 127.0.0.1 --port 4349 --strictPort
```

Open `http://127.0.0.1:4349/` after restarting the preview. The fixture is frozen for this QA session. Do not
regenerate it during QA. Afterwards, `/private/tmp/comparison-task-5-generate.ts`
reproduces it from maintained sources, followed by the three npm commands above.

Promo preview, using an unused port, from the managed worktree:

```sh
bun run --filter @opsydyn/promo preview --host 127.0.0.1 --port 4350
```

Visit `/examples/comparison/` and `/downloads/comparison-template.json`.
The reference Astro preview instructions above remain applicable.

### Controller-observed standalone browser results

The controller supplied these native Firefox observations on 2026-10-08.
These were not observed independently by the implementer:

- [x] Captured order Histogram 2, Scatter 3, Scatter 1; linking off, counter 4.
- [x] Enabling linking and histogram keyboard inspection produces six matches,
      with dashed outlines on both scatter panels.
- [x] Reorder twice using Return retains the same focused move control at the
      endpoint.
- [x] Adding Histogram allocates ID 4 and disables both add controls.
- [x] At 390px the panels use a single column and controls fit.
- [ ] Visual correction: the maintained scatter's vertical `SALARY($)` label
      overlaps the `100000` y tick at desktop and 390px. The controller assigns
      this to the final fix/review wave, not Task 5; shared chart code and the
      preserved preview remain unchanged.

### Remaining acceptance

- [ ] Further controller native Firefox observations for reference and promo.
- [ ] Complete removal/focus, pointer hit testing after movement/resize/scroll,
      reduced motion, teardown and runtime/console checks.
- [ ] Real ZIP download and StackBlitz delivery in the hosted promo page.
- [ ] Controller independent final review and the scatter label-overlap fix.

These gates are pending exclusive Firefox access, not blocked by a locked Mac.
The controller stopped UI actions and requested a brief exclusive session after
its tab was navigated to unrelated Rosterium activity. The observed standalone
subset remains valid; full 390px, host/promo, console and reduced-motion checks
are not claimed. The generated fixture remains unchanged.
No UI tools were used by the Task 5
implementer. Browser, native accessibility and device acceptance remain separate.
No push, merge, publication or deployment occurred.
