# Pending-creation node retention

- **result:** complete
- **claim:** opt-in pending-creation retention preserves source/port feedback and
  reduces the 320-node broad-query listener-to-DOM p95 from 45.3–45.7 to 28.3–28.6 ms.
- **evidence:** red/green package tests, 234 passing Flow tests, workspace checks,
  TypeDoc/build validation, browser interaction checks, inspected screenshot and
  ten sequential benchmark passes with raw samples/source hashes.
- **remaining uncertainty:** local serial headless timing does not establish INP,
  physical paint or cross-device performance; policy/custom-renderer fallbacks remain.
- **next:** retain node bodies while keeping policy-controlled ports live, so
  protected diagrams can benefit without caching permission decisions.

## Change and safeguards

The existing package `nodeViewCache` option now covers eligible pending creation.
The retained renderer receives `state.connection` as an explicit lazy argument
instead of hard-coding `null`. Changing the source, cancelling, creating a
connection, changing graph/selection/read-only state or mounted membership
invalidates the layer through its existing inputs. Unrelated chooser filtering
can reuse it. No durable state or permissions are stored in the view.

Custom node shells/ports, node policies, visibility/group filtering, open context
panels and editing gestures retain their existing live-render fallbacks. Port
policies stay live so locks and protection reasons update. The reducer still owns
permission checks and history. Culling already pins the staged source and now
passes its mounted mask through the retained layer during creation.

This extends the existing optional renderer within the current package boundary;
there is no new API signature, model schema, dependency or architecture boundary.
The public option comment, README, TypeDoc overview and changelog describe the
extended eligibility. No new ADR is required. The Astro workbench uses its
existing **Retain node views** switch to demonstrate the package behavior.

## Tests and browser evidence

Before implementation, the new test failed because pending creation never called
the retention slot. Package tests then check stable lazy inputs on unrelated
updates, changed inputs and native `aria-pressed` feedback on source changes and
cancellation, read-only controls, creation/Undo/restaging, policy and custom-port
fallbacks, editing gestures, and pinned-source culling membership.

The package tests use a recording slot that executes the actual retained renderer;
they establish eligibility, lazy-input equality and rendered output, rather than
claiming to exercise FoldKit's internal memoization implementation. The production
workbench uses its real `createLazy()` slot for the browser and timing runs.

The production [interaction check](endpoint-creation-retention-check.json) passed:
source switching, native port feedback, filter focus, policy fallback, cancellation,
creation, Undo and native keyboard restaging. The workbench intentionally cancels
pending creation when a lock changes; the driver asserts that cancellation,
restages under the lock, then unlocks and restages again. The initial driver
assumption that lock toggles preserved staging was corrected to match the existing
workbench update rule; no product behavior was changed for the check.

[Visual evidence: active Review output after Undo and keyboard restaging](endpoint-creation-retention.png).
The screenshot was inspected; browser assertions separately check `aria-pressed`,
disabled state, protection copy and graph counts.

## Benchmark method and provenance

Measured on 2026-11-07: Apple M4 Pro, arm64, Darwin `25.6.0`, Bun `1.4.4`,
Chromium `151.0.7922.34`, no CPU throttling. Browser viewport, color scheme and
reduced-motion setting match the preceding runs.

The [original method](endpoint-chooser-benchmark.md) and
[indexed-validation comparison](endpoint-chooser-indexing.md) remain historical
evidence. The current harness adds only fixture selection through
`FLOW_CHOOSER_BENCH_RETAINED_CREATION=1` with `FLOW_CHOOSER_BENCH_RETAINED=1`;
measurement instrumentation, warmups, sample counts and queries are unchanged.
This selects the two large creation cases instead of the existing retained
reconnection cases. All other benchmark modes keep their previous cases.

A fresh before pair runs the production package at parent `c7542d3` with retention
on, while pending creation still uses live rendering. Follow-up pairs cover package
resolution, default browser, retained reconnection and retained creation. Runs are
sequential, without concurrent assistant builds/tests; OS activity is uncontrolled.
The parent hash in follow-up JSON identifies the checkout before commit; the
separate source manifest identifies the measured source edits. Timings are local
serial headless measurements, not INP, physical paint or cross-device guarantees.

`retainedLayerMounted` in the inherited harness detects the `display:contents`
wrapper. Both live fallback and lazy paths use that wrapper; the field is not a
cache-hit counter. Eligibility/input tests and the controlled before/after toggle
comparison supply evidence for this extension.

## Results

Package p95 milliseconds across both case orders:

| Nodes / targets | Creation resolution | Reconnection resolution |
| --------------- | ------------------: | ----------------------: |
| 32 / 64         |         0.039–0.047 |             0.037–0.040 |
| 320 / 640       |         0.286–0.317 |             0.268–0.274 |
| 1,000 / 2,000   |         1.337–1.376 |             1.244–1.290 |

Both package runs retain the indexed baseline's checksum, candidate/fixture counts
and untimed policy-call counts. This slice does not change resolver algorithms.

Retained creation, p95 milliseconds across both orders; the toggle is **on** in
both the fresh before and after measurements:

| Case                      | Before listener → options DOM | After listener → options DOM | Before input → next rAF | After input → next rAF |
| ------------------------- | ----------------------------: | ---------------------------: | ----------------------: | ---------------------: |
| Large creation, broad     |                     45.3–45.7 |                    28.3–28.6 |               53.2–54.1 |              35.8–35.9 |
| Large creation, selective |                     43.9–44.7 |                    27.9–28.1 |               50.3–51.8 |              34.5–35.0 |

The control runs with retention **off** remain at 44.8–46.5 ms listener-to-DOM p95
for broad creation and 45.5–47.6 ms for selective creation. The gain is local to
the opt-in eligible path; no default performance improvement or all-diagram
speedup is claimed. Both query directions, exact option values, focus and graph
counts are asserted by the harness.

| Default workbench case        | Listener → options DOM | Input → next rAF |
| ----------------------------- | ---------------------: | ---------------: |
| Release creation, broad       |              18.5–19.4 |        32.7–33.9 |
| Large creation, broad         |              44.8–46.5 |        52.3–56.2 |
| Large creation, selective     |              45.5–47.6 |        51.9–53.6 |
| Release reconnection, broad   |              18.9–19.6 |        32.7–33.3 |
| Large reconnection, broad     |              49.2–49.7 |        54.0–54.5 |
| Large reconnection, selective |              43.8–44.1 |        50.8–51.2 |

| Retained reconnection case    | Listener → options DOM | Input → next rAF |
| ----------------------------- | ---------------------: | ---------------: |
| Large reconnection, broad     |              31.7–32.2 |        36.6–36.7 |
| Large reconnection, selective |              27.2–27.4 |        34.3–34.4 |

Fresh retained-creation baseline: [forward](endpoint-creation-retention-before-forward.json) ·
[reverse](endpoint-creation-retention-before-reverse.json).
Retained creation after: [forward](endpoint-creation-retention-after-forward.json) ·
[reverse](endpoint-creation-retention-after-reverse.json).
Default browser after: [forward](endpoint-creation-retention-browser-forward.json) ·
[reverse](endpoint-creation-retention-browser-reverse.json).
Retained reconnection after: [forward](endpoint-creation-retention-reconnection-forward.json) ·
[reverse](endpoint-creation-retention-reconnection-reverse.json).

Package samples: [forward](endpoint-creation-retention-core-forward.json) ·
[reverse](endpoint-creation-retention-core-reverse.json).

## Reproduce

Use the original commands for the core/default/retained-reconnection matrix. For
the new pair, run from `apps/web` after the production sample build:

```sh
FLOW_CHOOSER_BENCH_RETAINED=1 FLOW_CHOOSER_BENCH_RETAINED_CREATION=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/creation-forward.json
FLOW_CHOOSER_BENCH_RETAINED=1 FLOW_CHOOSER_BENCH_RETAINED_CREATION=1 FLOW_CHOOSER_BENCH_REVERSE=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/creation-reverse.json
bun - < ../flow-sample/evidence/endpoint-creation-retention-check.mjs > /tmp/creation-check.json
```

The interaction driver saves `endpoint-creation-retention.png` in the evidence
folder. Keep the previous baseline files when collecting future measurements.

## Qualification

- Baseline workspace typecheck and lint/format checks: exit 0.
- Targeted retention/diagnostics tests: 14 passed, exit 0.
- Final `bun typecheck`: exit 0.
- Full `bun run test`: exit 0, including 234 Flow tests and packed-consumer checks.
- Flow TypeDoc build: exit 0, with warnings treated as errors.
- Production sample build with source maps: exit 0.
- Browser interaction driver: exit 0; no page errors; screenshot inspected.
- Fresh before pair plus eight follow-up benchmark passes: all exit 0.
- Post-run comparisons verify environment, fixtures, candidate/option/sample
  counts, query direction balance, retention-wrapper state and source hashes.
- Final benchmark TypeScript and workspace lint/format/catalog checks: exit 0.

[Measured-source manifest](endpoint-creation-retention-sources.json) records the
original renderer hash and the final renderer, package test and harness hashes.
The production change is a lazy input and eligibility extension; reducer/history
code and policy callbacks are untouched.

Self-review: removing the eligibility guard alone would fail the feedback tests
because the old retained renderer used a null source. The tests independently
assert native feedback and key changes. Existing guards still exclude custom
ports/node policies and active gestures; browser checks cover leaving and
returning to eligibility through policy changes. No permission result is cached.
Recovery is disabling the opt-in slot or reverting this commit; no migration is
required. No publication, PR, hosted/CI or formal screen-reader qualification is
claimed.

Recommendation: **needs follow-up** for retaining node bodies with a live port
layer under per-port policies. Keep policy reasons, disabled states and commit
validation fresh, and benchmark that path before promising a gain.
