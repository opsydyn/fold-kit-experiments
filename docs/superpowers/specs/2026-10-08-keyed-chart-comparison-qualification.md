# Keyed chart comparison: Astro host qualification

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
controller reported that CUA `getApp` found the Mac locked and auto-unlock failed;
the user was asked to unlock it asynchronously. This is the concrete current
blocker. No bypass or unlock attempt was made by this implementer. No live
browser evidence has been supplied, and no preview server was started here.

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
devices, or browser hydration. Promo and standalone acceptance belong to later
tasks. No push, merge, publication or deployment occurred.

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
