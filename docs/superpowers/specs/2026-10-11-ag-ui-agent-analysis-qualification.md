# AG-UI Agent Analysis Qualification

Status: Tasks 1-3 implemented and independently reviewed. The approved internal
Astro retention repair is implemented and independently reviewed. Task 4's
approved Service Incident Lab refinement has an independent compliant/approved
source review and passing local desktop/mobile qualification. The strengthened
browser assertion follow-up also passes and its scoped review confirms the
finding is addressed with no new blocking issues. Task 4 is committed as
`083dff8` and fast-forwarded into local `main`. The user has approved pushing
all reviewed work. Task 5 remains open.

Checkout: managed worktree `ag-ui-agent-analysis`, branch
`codex/ag-ui-agent-analysis`, starting at `16bed58`.
The reviewed Tasks 1-3 and internal Astro fixes were subsequently fast-forwarded
into local `main` with the user's approval, through `6b6b9c9`. Task 4's demo and
approved Service Incident Lab refinement were then committed as `083dff8` and
merged locally on the user's subsequent instruction. That instruction also
authorises pushing `main`; no separate package publication was requested.
Existing hosted workflows may deploy the pushed changes.

## Baseline

| Command                         | Result                                      | Evidence                                      |
| ------------------------------- | ------------------------------------------- | --------------------------------------------- |
| `bun install --frozen-lockfile` | Exit 0; 618 packages installed              | Fresh isolated checkout                       |
| `bun typecheck`                 | Exit 0; web 0 errors, warnings and hints    | `/tmp/agui-implementation-baseline-types.log` |
| `bun run check`                 | Exit 0; 993 files formatted                 | `/tmp/agui-implementation-baseline-check.log` |
| `bun run test`                  | Exit 0; 593 passed, one existing promo skip | `/tmp/agui-implementation-baseline-tests.log` |

## Feature Gates

- [x] Validated Model and pure update transitions: `c55d167`, 45 focused tests;
      independent review spec compliant and quality approved.
- [x] Request-scoped SSE fixtures and byte limits: `a933de4`, `cfcd4d6`;
      32 focused tests and scoped review of pending-cancellation overflow fix.
- [x] Effect Stream SSE refactor: `2888e08`; independent review approved;
      44 backend/transport tests and 698 workspace passes, one existing skip.
- [x] Scoped client transport and real runtime navigation: `e46aba3`,
      90 combined focused tests and independent review approved.
- [x] Local chart rendering, hydration and retained hosts (Task 4)
- [ ] Full desktop/mobile browser acceptance
- [ ] CI browser configuration
- [ ] Compiled Cloudflare endpoint streaming on local emulator
- [x] Lint, types, workspace tests and production build for the Task 4 slice
- [ ] Independent whole-branch review
- [x] Maintained example guide

Screen-reader acceptance, deployed behaviour, npm publication and backend compute
cancellation remain unqualified and outside this slice.

## Internal Retention Repair

Task 4's real desktop/mobile smoke tests preserve the Astro-owned wrapper but
replace the rendered FoldKit child and reset the app to Idle. The integration
uses the Astro island as FoldKit's replaceable mount; Astro's after-swap unmount
then disposes the disconnected island. An app-owned persistence wrapper alone
does not preserve runtime continuity. The user approved a focused internal
integration repair, amending the app-only source boundary without changing the
public API.

Package commits `a6a1753` and `3b7fbeb` mount FoldKit inside the existing SSR shell, preserving
the outer Astro lifecycle owner. Empty/client-only hosts receive an inner mount.
Host-scoped initialization ownership prevents duplicate runtimes when Astro
reconnects or invokes hydration again, including overlapping loads; genuine
unmount or initialization failure releases active ownership. Pure init is checked
before runtime startup, and an inactive weakly keyed program is reused on the
same host so public FoldKit embed sequences previous teardown before restart.
The host continues to represent the same app/schema/ports/update definition.
Props remain init-only for the live runtime; app-owned ports handle post-init data.

Final qualification: 28 client regressions and all four unchanged real browser
smoke cases pass at desktop/mobile viewports. The smoke preserves actual rendered
root identity, selection, accepted count, scenario, one request, reverse
navigation, theme toggles and cancellation. Root check/types/tests and web build
pass; 715 tests pass with one existing promo artifact skip. Final web/promo types
report zero errors, warnings and hints. Independent review and scoped recovery
re-review approved the repair with no remaining blocking findings.

Controller reran the final root check/typecheck/tests, production web build and
unchanged browser smoke on `3b7fbeb`; all exited zero. Logs:
`/tmp/retention-controller-final-{check,types,tests,build,browser}.log`.
The controller browser run passed all four cases on its first attempt; the owned
server stopped. Earlier worker dev-browser failures (outdated Vite dependencies,
then destroyed initial navigation context) remain disclosed harness-stability
concerns for Task 5, not erased by the final green runs.

The controller previously inspected desktop and 390px screenshots in
both light and dark themes: four actual marks, table selection and focus are
visible; mobile chart/table scroll inside their containers. This is visual
inspection of saved evidence, not a fresh controller-run browser test.

At the original repair checkpoint, Task 4 UI/host changes remained uncommitted
in the isolated worktree pending their own review and commit. The subsequent
review and `083dff8` merge are described above. The internal package fix does not
complete full browser CI, compiled Cloudflare endpoint qualification or the final
whole-branch review. This paragraph records the original repair checkpoint;
the subsequent authorised local merge is described above. No push or release
occurred as part of that merge.

## Service Incident Lab Refinement

The user approved the interactive visual direction and implementation as a
bounded refinement of Task 4. The original mobile horizontal-scroll requirement
is superseded by a fixed-domain chart and concise table that fit a 390px viewport.
The app owns its first-valid-snapshot comparison baseline, selected-service
inspector, illustrative 100ms p95 budget and bounded rejected-update evidence.
Astro and Viz retain their existing package responsibilities and public APIs.

Pre-refinement controller baseline: `bun run check`, `bun typecheck` and
`bun run test` all exited zero, with 715 tests passing and one existing promo
skip. The new real-browser incident comparison test failed against the old UI
because the approved Service Incident Lab heading was absent. Final refinement
qualification is recorded below.

Controller verification on the combined uncommitted Task 4 changes:

| Command                                  | Result                                            | Evidence                                     |
| ---------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| `bun run check`                          | Exit 0; clean lint/format                         | `/tmp/incident-controller-check.log`         |
| `bun typecheck`                          | Exit 0; web 573 files, zero errors/warnings/hints | `/tmp/incident-controller-types.log`         |
| `bun run test`                           | Exit 0; 724 passed, one existing promo skip       | `/tmp/incident-controller-tests.log`         |
| Web production build                     | Exit 0; >500kB minified-chunk advisory            | `/tmp/incident-controller-build.log`         |
| Web `test:e2e` after assertion follow-up | Exit 0; 8 desktop/mobile cases passed             | `/tmp/incident-controller-browser-final.log` |

The real-browser tests preserve the same island and rendered DOM across retained
navigation, one request, selected service, counters, reverse navigation, theme
switching and cancellation. Incident cases check the coherent API 145ms value,
60ms baseline, New-service comparison, rejection of 999ms and user-directed
restart. All marks stay inside the SVG and the chart/table/document fit 390px.
SVG text bounding-box comparisons report no label overlaps in both themes.
Controller inspected saved desktop dark and mobile light/completed and
mobile dark/rejected screenshots: marks, baseline trail, budget line, table,
inspector and selection focus are visible without incoherent overlap.

Independent Task 4 review found no Critical or Important issues: spec compliant,
quality approved. Its two Minors were stronger direct API mark/table assertions
in the rejection browser case and attribution of the large-chunk build advisory.
The former is implemented, passes in both viewport projects and has an approved
scoped re-review. The largest client JavaScript artifact is the syntax-highlighting bundle
`highlighting-browser.B9ZtDk7j.js`, approximately 624 KiB on disk. No splitting or
warning-limit change was made; this remains a bounded performance follow-up.
This is local dev-endpoint/browser evidence, not compiled Worker or hosted proof.

Test-owned ports 4371 and 63104 have no listener after qualification. The exact
leaked package-integration Astro process was identified by checkout, start time
and `astro-page-smoke-build` response stamp before being stopped. Its foreground
ownership repair remains Task 5 work. A separate managed review server is running
on `http://127.0.0.1:4372/agent-analysis` from this worktree; it does not replace
the primary checkout's server.

## Authorised Main Merge

On the user's subsequent merge-and-push instruction, the reviewed Task 4 files
were committed as `083dff8` and `main` fast-forwarded to that commit. Fresh frozen
install, root lint/typechecks, production workspace build and all eight real
desktop/mobile browser cases passed in the main checkout. Logs:
`/tmp/agui-merge-main-{install,check,types,build,browser}.log`.

The full workspace suite passed again after the merge: 724 tests and one existing
promo skip. It ran from the isolated worktree at the identical merged commit,
with only this documentation checkpoint pending, because the existing integration
harness uses `dev --force` and would otherwise replace the primary server. Log:
`/tmp/agui-merge-merged-tests.log`. The primary server was not stopped.

The large syntax-highlighting chunk advisory remains disclosed. Hosted CI and
deployment results are not implied by these local checks; Task 5's browser CI,
compiled Worker streaming and final whole-plan review remain open.

Maintained guide: [AG-UI Agent Analysis](../../examples/ag-ui-agent-analysis.md).
