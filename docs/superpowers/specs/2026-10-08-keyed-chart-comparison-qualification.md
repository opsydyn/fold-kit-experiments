# Keyed chart comparison: host and export qualification

Date: 2026-10-08. Task 4 baseline: `6e2afbd`, clean managed
`keyed-chart-comparison` worktree.

Latest source checkpoint: `f0705f2`. Independent final re-review confirms all
seven source findings addressed, with no new Important/Critical regressions.
The single final source correction wave from `cac26d1`
addresses I1-I3 and M1-M4, with **529 workspace tests**, check/typecheck,
both app builds, Storybook and a new standalone install/typecheck/build passing.
The Task 4/5 sections below are historical evidence. See the final correction
section for current source fixes and `/private/tmp/comparison-final-preview`.
Native/browser acceptance, including visual rechecks of I2/I3, remains pending
exclusive Firefox access. No browser was operated during this wave.

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
- [x] Controller independent final source review and label-spacing correction.
- [ ] Post-fix native visual recheck of label spacing and shared-chart focus.

These gates are pending exclusive Firefox access, not blocked by a locked Mac.
The controller stopped UI actions and requested a brief exclusive session after
its tab was navigated to unrelated Rosterium activity. The observed standalone
subset remains valid; full 390px, host/promo, console and reduced-motion checks
are not claimed. The generated fixture remains unchanged.
No UI tools were used by the Task 5
implementer. Browser, native accessibility and device acceptance remain separate.
No push, merge, publication or deployment occurred.

## Single final source correction wave

Baseline: `cac26d161a538edd45dacd914e5981970712904b`, initially clean.
The exact commit and per-finding commands/results are in
`.superpowers/sdd/2026-10-08-keyed-chart-comparison/final-fix-report.md`.
No subagents, new worktree, renderer/public-package API changes, dependency
changes, push, merge, publication or preview servers were used.

### Corrections and regression evidence

| Finding | Maintained-source correction                                                                                                                                                                                                                                                                    | Automated evidence                                                                                                                                                                                                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I1      | Scoped Mount measures each pointer event and synchronously forwards an element-local, schema-checked custom event to the normal FoldKit DOM dispatcher. Leave/keyboard remain synchronous. No delayed clear, parent workaround, external ordering state or DOM references in Model/view/update. | Four actual `Runtime.embed` same-task tests failed before correction: move/leave, move/leave/histogram entry, move/scatter key, move/histogram key. All pass without yielding between input events. Separate-task control, fresh geometry after reorder/scroll/resize, and listener disposal remain covered. |
| I2      | Default scatter left gutter is 104px, budgeting separate title, gap and six-digit tick bands; existing readable font sizes and scale/client-coordinate contracts are retained.                                                                                                                  | Two salary-fixture render/layout regressions failed with tick x=44 and now pass at chart widths 380 and 342. Existing actual-runtime pointer/geometry tests pass with the changed margin. These are not measured native glyph bounds or visual rechecks.                                                     |
| I3      | Shared SVG root no longer suppresses the native outline. Comparison-specific focus-visible styling remains unchanged; no tab stop was added.                                                                                                                                                    | Three mounted-runtime tests failed on `outline: none` and now pass for standalone histogram, standalone scatter and both diagnostics charts outside comparison. Native focus appearance and assistive technology remain unqualified.                                                                         |
| M1      | Unselected reverse navigation selects `n - 1`; forward starts at zero.                                                                                                                                                                                                                          | One/two/three-item tests cover all four arrow keys, first selection and wraparound; histogram output agrees with pointer inspection. RED included the one-item negative-zero result.                                                                                                                         |
| M2      | Scatter resize rejects a resulting `pw <= 0`, retaining the last usable layout and inspection.                                                                                                                                                                                                  | Below/equal-to-margin-sum rejection and positive recovery failed before correction and now pass.                                                                                                                                                                                                             |
| M3      | Legacy linked charts and comparison matching use the same small pure app-owned `containsValue` predicate.                                                                                                                                                                                       | New shared-callable contract was RED before export; endpoint truth table and existing consumer tests pass. This removes equivalent duplication, not a previously observed endpoint divergence.                                                                                                               |
| M4      | Host test waits for every chart observer's disconnect and the scatter listener's removal before exercising disposed targets; drains one zero-delay event-loop task afterwards.                                                                                                                  | Removing observer finalisation temporarily made the strengthened test fail (expected one disconnect, received zero). Restoring it passes. This mutation check qualifies the test improvement, not a claim of a pre-existing production leak. Both 50ms sleeps are removed.                                   |

Focused logs are `/private/tmp/comparison-final-i1-{red,green}.log`,
`comparison-final-chart-{red,green}.log`, `comparison-final-i3-red.log`,
`comparison-final-m3-red.log`, `comparison-final-m3-m4-green.log`, and
`comparison-final-m4-{red,green}.log` under the same directory.
Final focused groups passed 25, 62 and 38 tests; the dedicated disposal suite
passed all four tests. The final complete workspace suite subsumes these groups.

### Final sequential gates

All commands below exited zero; builds and tests did not overlap:

- `bun run check`: no lint/format errors or warnings.
- `bun typecheck`: zero errors, warnings or hints, including 538 web files.
- `NPM_CONFIG_CACHE=/private/tmp/foldkit-npm-cache bun run test`: **529 passing**,
  zero failures (Astro 77, Viz 168, promo 55, web 229 in 38 files).
- `env -u FOLDKIT_BUILD_ID bun run --filter @opsydyn/web build`: no warnings.
- `env -u FOLDKIT_BUILD_ID bun run --filter @opsydyn/promo build`: no warnings.
- `env -u FOLDKIT_BUILD_ID bun run --filter @opsydyn/web build-storybook`:
  completed with the retained greater-than-500kB advisory, axe 579.43kB and
  iframe 812.55kB. No bundle attribution/performance claim or optimisation.
- `git diff --check`: no whitespace errors.

Logs: `/private/tmp/comparison-final-{check,typecheck,tests,web-build,promo-build,storybook}.log`.

### Distinct corrected standalone fixture

`bun /private/tmp/comparison-final-generate.ts` generated 64 files from current
maintained source into **`/private/tmp/comparison-final-preview`**. Captured
settings are Histogram 2, Scatter 3, Scatter 1; linking off; `nextPanelId: 4`.
Only the data-only initial settings are replaced; validation remains present.
From that directory, all three commands exited zero:

```sh
NPM_CONFIG_CACHE=/private/tmp/foldkit-npm-cache npm install --no-audit --no-fund
npm run typecheck
npm run build
```

Logs: `/private/tmp/comparison-final-preview-{generate,install,typecheck,build}.log`.
Install added 41 packages. The standalone build produced a 470.06kB JS asset
without warnings. No preview server was started and no browser inspected it.

The frozen `/private/tmp/comparison-task-5-preview` remains unchanged. Read-only
before/after fingerprints cover all 7,468 files (122,624,897 bytes), paths,
metadata and symlink targets, including dependencies and build output.
Both SHA-256 fingerprints are
`4e15c802a05d0e01d4eb2cae7da279b285c0f0ab4cbaea70a0d84efada0e1d17`.
`cmp` of `/private/tmp/comparison-final-old-preview-{before,after}.json` exited zero.
Earlier screenshots belong to that old fixture, not to the corrected source.

### Acceptance boundary

All seven source corrections are implemented and automatically qualified;
no unresolved source finding was identified in self-review. This does not
close the controller's observed axis overlap: its post-fix desktop and 390px
visual recheck, native shared-chart focus (including diagnostics), the complete
reference/promo journeys, pointer checks, reduced motion, teardown, console,
runtime multiplicity, real ZIP/StackBlitz delivery and assistive-technology/device
checks remain pending. Exclusive Firefox permission has been requested but not
approved. Merge readiness remains a separate controller decision; no merge,
push or publication is authorised or claimed.

## Controller verification and current preview

At `f0705f2`, the controller independently ran these sequential gates, all
with exit zero: `bun run check`, `bun typecheck`,
`NPM_CONFIG_CACHE=/private/tmp/foldkit-npm-cache bun run test`,
`env -u FOLDKIT_BUILD_ID bun run build`, and
`bun run --filter @opsydyn/web build-storybook`.
All 529 tests passed (77 integration, 168 Viz, 55 promo, 229 web).
The Storybook chunk advisory remains; lint and typecheck are clean.
Logs: `/tmp/comparison-controller-final-{check,typecheck,tests,build,storybook}.log`.

Independent scoped re-review checked I1-I3 and M1-M4 and found all addressed
in source, with no unresolved source findings. The pointer bridge guarantees
synchronous ordered enqueue into FoldKit's FIFO queue, not unconditional
reducer completion before a subsequent event when the runtime yields.
Reports and the execution ledger remain in this plan's ignored SDD directory
while browser acceptance is outstanding.

A local development server is now available at
`http://127.0.0.1:4347/comparison` (Astro PID 63378), started from this managed
worktree with `bun run --filter @opsydyn/web dev --host 127.0.0.1 --port 4347`.
The route returned HTTP 200. This is transport evidence, not browser acceptance.
Use `bun run --filter @opsydyn/web astro dev stop` in this worktree to stop it.
No unrelated server or browser tab was changed. No merge, push or publication.
