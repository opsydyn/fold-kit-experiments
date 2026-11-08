# Endpoint chooser benchmark

- **result:** complete
- **claim:** reproducible local measurements distinguish candidate resolution,
  projection, field construction and full-workbench input response, with a
  separate retained-node A/B and CPU profile.
- **evidence:** two case orders, raw samples, mapped profile, harness assertions,
  benchmark TypeScript check, workspace typecheck/check and 226 passing Flow tests.
- **remaining uncertainty:** serial headless timings are not INP, physical paint
  or cross-device evidence; host-policy and unrepresented configuration costs vary.
- **next:** per-resolver validation indexes with fresh permissions, followed by
  the same benchmark matrix; renderer work remains a separate concern.

Measured on 2026-11-07 against production sources at `3be39f5`. This slice adds
benchmark tooling and evidence; it does not optimize production code or change
chooser behavior.

## Findings and next decision

There are two distinct costs. In the 320-node workbench, constructing/reconciling
the larger view matters: the existing **Retain node views** option reduces
reconnection listener-to-options-DOM p95 from **57.0–64.2 ms to 31.1–31.6 ms** for
the broad query. In the independent 1,000-node package fixture, creation-candidate
resolution takes **39.9–49.6 ms p95**, while a single broad filtering/grouping pass
takes **0.20–0.21 ms p95**. Filtering a menu is not equivalent to reducing the
validation or whole-view workload.

Recommend a bounded package optimization next: build fresh endpoint/port and
duplicate-edge indexes once per resolver pass, and avoid rebuilding the same
remaining-edge array and proposed ID for every candidate. Keep policy evaluation
current and preserve reason precedence, replacement-edge exclusion, events and
history. Do not introduce a cross-render permission cache. Re-run these benchmarks
after implementation; no particular speedup is promised before that comparison.

Existing node retention is already an available opt-in for eligible diagrams.
The package deliberately excludes a pending creation source from that path, so
the reconnection A/B result does not establish a creation improvement. Extending
retained rendering during creation is a separate follow-up with its own state
and protection checks.

## Environment and method

- Apple M4 Pro, arm64, Darwin `25.6.0`; Bun `1.4.4` for package measurements and
  headless Chromium `151.0.7922.34` for browser measurements. No CPU throttling.
- Measured passes ran sequentially without concurrent assistant builds/tests.
  Other operating-system activity was not controlled. Ranges below are the
  observed forward/reverse-order results, not confidence intervals or guarantees.
- Package fixture: 32/320/1,000 nodes, four ports per node, two directed chains,
  respectively 62/638/1,998 edges and 64/640/2,000 target candidates. The policy
  uses constant-time input reservation and self-connection rules. Callback counts
  are recorded in a separate untimed resolution, avoiding a timer around each
  policy call. Creation resolution includes both source and target contexts;
  reconnection resolution measures one target end.
- Package measurements use eight warm-up operations and 40 samples. Projection
  samples average ten calls per batch; other phases are individual calls. p50/p95
  use nearest-rank selection. Results are consumed through a checksum, and fixture
  counts, selective matches and rendered groups are asserted.
- Field-tree construction uses precomputed candidates inside FoldKit's real SSR
  view frame. It includes the primitives' filtering/grouping passes and HTML-tree
  construction, but excludes candidate resolution. The separately recorded SSR
  envelope includes framework execution and serialization; neither is a browser
  DOM-patching measurement.
- Browser fixture: the actual production Astro release example (3 nodes/1 edge)
  and large workflow (320 nodes/452 edges), default cards, full diagnostics,
  1280 × 1100 viewport, light scheme and reduced motion. The synthetic package
  fixture has different port/edge density and is not subtracted from browser time.
- Each browser case uses three fresh pages, four warm-up inputs and 20 measured
  inputs per page: 60 samples per order, half narrowing and half expanding.
  Broad queries alternate `''` and `z`; selective queries alternate `load-20-`
  and `load-20-z`. The latter matches one 16-node lane. Reconnection retains the
  current endpoint; creation retains its placeholder.
- Focus is set once, then trusted `page.keyboard.press` events type `z`/Backspace
  directly. No locator is re-resolved before each measured key. A capture listener
  records input delivery; a mutation observer acknowledges the exact expected
  option values, followed by the next animation-frame callback. Ignored inputs,
  changed graph counts, lost focus or page errors fail the run.
- Listener-to-DOM includes scheduling, view work, reconciliation and observer
  acknowledgement. Input-to-frame includes browser delivery and the following
  callback. These serial headless measurements are **not INP, burst throughput or
  physical display/paint latency**. See the
  [HTML animation-frame model](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames).

## Package results

All values are p95 milliseconds, expressed as the range of the two case orders.

| Nodes / targets | Creation resolution | Reconnection resolution | Broad projection, per call in batch | Grouped field tree, broad | SSR envelope, broad |
| --------------- | ------------------: | ----------------------: | ----------------------------------: | ------------------------: | ------------------: |
| 32 / 64         |         0.083–0.172 |             0.042–0.082 |                         0.010–0.013 |               0.076–0.163 |           1.21–1.99 |
| 320 / 640       |           5.03–5.53 |               3.24–3.29 |                         0.096–0.102 |                 0.74–1.13 |           7.87–8.25 |
| 1,000 / 2,000   |         39.95–49.57 |             27.50–27.66 |                         0.198–0.207 |                 2.73–3.19 |         24.13–24.74 |

Source review identifies repeated node/port searches, edge-array filtering and
duplicate scans inside `connectionReason`, plus repeated ID scans for creation.
Those are concrete indexing targets. The 1,000-node creation resolution invokes
6,001 port-policy callbacks and 1,899 global-policy callbacks in the untimed
counting pass. Expensive host policies could remain a separate cost after indexing.

Raw samples: [forward](endpoint-chooser-core-forward.json) ·
[reverse](endpoint-chooser-core-reverse.json).

## Production workbench results

P95 milliseconds; ranges span the two orders. Option counts include the creation
placeholder or the retained reconnection selection.

| Workflow                                | Expanded ↔ narrowed options | Listener → options DOM | Input event → next rAF |
| --------------------------------------- | --------------------------: | ---------------------: | ---------------------: |
| Release creation, broad                 |                       3 ↔ 1 |              18.3–18.3 |              32.8–32.8 |
| Large creation, broad                   |                     321 ↔ 1 |              45.1–46.1 |              53.3–53.6 |
| Large creation, selective               |                      17 ↔ 1 |              44.5–44.7 |              51.3–51.5 |
| Release reconnection, broad             |                       2 ↔ 1 |              18.4–18.6 |              32.7–33.4 |
| Large reconnection, broad               |                     320 ↔ 1 |              57.0–64.2 |              60.7–67.8 |
| Large reconnection, selective           |                      17 ↔ 1 |              58.5–58.7 |              65.3–65.8 |
| Large reconnection, broad, retained     |                     320 ↔ 1 |              31.1–31.6 |              35.4–36.3 |
| Large reconnection, selective, retained |                      17 ↔ 1 |              28.8–36.8 |              35.7–44.1 |

The retention A/B keeps the graph, rendered node/edge counts and interactions
fixed, checks the retention toggle, and records that the retained layer is
mounted. Merely displaying fewer choices did not remove the broader workbench
cost in these runs. The A/B does not prove that a specific individual framework
function accounts for its entire improvement.

Raw samples: [forward](endpoint-chooser-browser-forward.json) ·
[reverse](endpoint-chooser-browser-reverse.json) ·
[retained forward](endpoint-chooser-browser-retained-forward.json) ·
[retained reverse](endpoint-chooser-browser-retained-reverse.json).

## Separate CPU profile

A separate large-reconnection run profiles 40 additional inputs with the
[CDP Profiler](https://chromedevtools.github.io/devtools-protocol/tot/Profiler/)
at a requested 1,000-microsecond interval. Its timing rows are not pooled into the
unprofiled tables. Vite and package source maps are chained; each sample is
attributed to its nearest mapped JavaScript ancestor. This is sampled attribution,
not exact function duration or complete browser rendering attribution.

| Source bucket              | Attributed sampled milliseconds over the profile |
| -------------------------- | -----------------------------------------------: |
| FoldKit HTML builder       |                                            380.9 |
| FoldKit DOM reflection     |                                            359.3 |
| Flow connection validation |                                            139.9 |
| Snabbdom reconciliation    |                                            112.3 |
| FoldKit branding           |                                            105.0 |
| Flow endpoint projection   |                                             21.2 |

There were 1,648 samples, with 104.8 ms attributed to GC, 216.4 ms to idle and
293.4 ms unmapped. Unmapped activity includes browser/program and evaluation
frames; it is not silently assigned to Flow. The profile corroborates both
framework view work and Flow validation cost, while the retention A/B supplies a
controlled configuration comparison.

[Raw Chrome CPU profile](endpoint-chooser-large-reconnection.cpuprofile) ·
[profile run](endpoint-chooser-profile.json) ·
[chained-source analysis](endpoint-chooser-profile-sources.json).

## Reproduce

From the repository root:

```sh
./packages/foldkit-flow/node_modules/.bin/tsc --noEmit -p packages/foldkit-flow/tsconfig.bench.json
bun packages/foldkit-flow/bench/choosers.ts > /tmp/chooser-core-forward.json
FLOW_CHOOSER_BENCH_REVERSE=1 bun packages/foldkit-flow/bench/choosers.ts > /tmp/chooser-core-reverse.json
FLOW_BENCHMARK_SOURCEMAPS=1 bun run --filter @opsydyn/flow-sample build
```

Then from `apps/web`, which owns the installed Playwright dependency:

```sh
bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/chooser-browser-forward.json
FLOW_CHOOSER_BENCH_REVERSE=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/chooser-browser-reverse.json
FLOW_CHOOSER_BENCH_RETAINED=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/chooser-browser-retained-forward.json
FLOW_CHOOSER_BENCH_RETAINED=1 FLOW_CHOOSER_BENCH_REVERSE=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/chooser-browser-retained-reverse.json
FLOW_CHOOSER_CPU_PROFILE=/tmp/chooser.cpuprofile bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/chooser-profile.json
FLOW_CHOOSER_ANALYZE_PROFILE=/tmp/chooser.cpuprofile bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/chooser-profile-sources.json
```

Keep source maps from the measured build when reanalyzing a saved profile. The
package also exposes `bench:choosers` for interactive repo use; direct `bun` calls
above avoid workspace log prefixes when saving JSON. Timings are diagnostic and
do not impose a machine-dependent CI budget.

## Qualification

Baseline workspace typecheck/check passed. The final benchmark-specific typecheck
and workspace lint/format check passed after scoping benchmark counters to one
run and using assertion errors for harness invariants. Final workspace typecheck
and full tests exited 0, with 226 Flow tests passing. No production source, API, schema or dependency changed, so no new
architecture decision is required. No CI, hosted, registry, physical-device or
screen-reader qualification is claimed.

Preliminary locator-driven browser measurements were discarded from the final
tables after identifying per-key locator resolution as a pacing confound. All
browser JSON linked above comes from direct keyboard runs. The optional retained
comparison uses an existing feature; this slice changes no default setting.

Recommendation: **needs follow-up** for per-pass validation indexing, preserving
fresh permission checks and measured separately from renderer work.
