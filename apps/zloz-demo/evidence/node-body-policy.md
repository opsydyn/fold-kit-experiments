# Retained bodies with live policy-controlled ports

- **result:** complete
- **claim:** opt-in retained bodies keep port authorization live and improve the
  large callback-enabled creation/reconnection measurements on this host.
- **evidence:** 240 passing Flow tests, strict packed consumer, workspace gates,
  TypeDoc/builds, actual input-identity/browser checks, inspected screenshot and
  16 sequential benchmark passes with raw samples and source hashes.
- **remaining uncertainty:** large fixtures install a callback without a matching
  protected Publish node; actual veto semantics are checked in the release case.
  Local serial headless timing does not establish INP or cross-device behavior.
- **next:** compose the public body cache into the custom Orbit shell demo while
  keeping its sockets and controls live.

## Contract and implementation

`createFlowNodeBodyCache()` and `FlowNodeBodyCache` are exported by
`@opsydyn/foldkit-flow/foldkit`. Supply one instance per canvas through
`FlowViewOptions.nodeBodyCache`. The existing workbench **Retain node views** switch
now supplies both whole-layer and body caches. The whole-layer path is preferred
where eligible; a port policy or custom port renderer can instead use retained
bodies with live frames and ports.

Slots use weak immutable node identities, not an indefinitely growing registry of
string IDs. Body inputs include node, selection, read-only, description, controls,
idle state, message adapter and content renderer. Graph snapshots, staged source,
port callbacks and permission decisions are excluded. Native drag/resize controls
accept only the state fields they actually consume; no synthetic graph is needed.

A layout-transparent body wrapper stays consistent across whole-layer/body/live
transitions while the body option is present. Ports remain direct children of
the existing visual shell, with the original coordinate plane and native control
order. Body policies, custom shells, open context panels, visibility/group
filtering and editing gestures retain live fallback behavior. Group bodies are
not retained by this option. The pure reducer, history and document schema are
unchanged.

Boundary self-review: **safe with noted risk**. The factory owns only VNode/lazy
artifacts in the optional adapter. Model ownership, measurements and commit-time
permission checks remain in their existing packages. One instance per canvas and
immutable nodes are required. A content callback that closes over changing
external display inputs must change reference when those inputs change.

The [dated extension of ADR 0004](../../../docs/adr/0004-composable-flow-presentation.md#retain-bodies-independently-of-live-ports-2026-11-07)
records alternatives, lifecycle bounds, safeguards and implementation criteria.
A live port overlay was rejected because it changes geometry/control order;
caching permissions was rejected because it can retain stale authorization.
This adds no dependency or alternate input runtime.

## Behavioral proof

The new tests initially failed because the body cache option was not consumed.
They exercise the production renderer with a recording slot: body-key stability
across changed policy results/source, current native disabled/title/pressed
feedback, custom live ports, native control order, direct-child port placement,
read-only/selection invalidation, culling/source pinning and live fallbacks.
They establish renderer arguments and output rather than testing FoldKit's
internal memoization algorithm. The workbench uses the real cache factory.

The production browser check passes with native/custom policy feedback, focused
body input identity and focus preserved through lock/unlock transitions, unchanged
canvas-relative bounds, source switching, cancellation, creation, Undo and native
keyboard restaging. The screenshot was captured with the Publish input locked and
the Review output staged. The packed consumer compiled and ran against the new
factory/option; final full-workspace qualification passed again after the fix below.

The initial browser reproduction found a real input-remount defect at the
whole-layer/live-port transition. Sharing nested body slots was not sufficient:
the outer wrapper also needed a shared constructor, because FoldKit compares
callsite identity in addition to key. A new package regression checks continuity
of body slots/keys across both modes, and the browser driver verifies actual DOM
identity after the port state acknowledges each policy update. A separate bounds
assertion was corrected from scroll-dependent screen coordinates to canvas-relative
coordinates. Final assertions were preserved rather than dropped.

## Benchmark method and provenance

The [original harness method](endpoint-chooser-benchmark.md) is unchanged: three
fresh pages, four warmups and 20 serial trusted inputs per page, 60 samples per
case/order, exact options acknowledged by a mutation observer then next rAF.
Queries alternate broad/selective sets with no matches. These are local headless
listener-to-options-DOM and input-to-next-rAF observations, not INP or physical
paint/display timing. Passes run sequentially without assistant builds/tests.
OS activity is uncontrolled, and ranges across two orders are not confidence
intervals or machine-independent performance guarantees.

The new `FLOW_CHOOSER_BENCH_PORT_POLICY=1` mode checks the existing **Lock Publish
input** checkbox. With retention enabled, it includes the small release case as
well as the large workflow. The release fixture contains Publish and asserts its
native port and final target option are disabled. The large workflow has no
Publish node: its policy callback is installed/evaluated but returns no port
vetoes. Large timings measure callback-enabled rendering; they are not a benchmark
of dense denied ports or expensive consumer policies. Semantic rejection/freshness
is separately covered by release/browser/unit tests.

Four fresh baseline passes use the parent production build at `906ad6c`: policy
creation and reconnection in both orders, still falling back to full node views.
Baseline bundles have no `nodeBodyCache` option; their hashes are recorded before
rebuilding the sample. Follow-up JSON records the parent HEAD because edits were
measured before committing; the source manifest identifies those measured edits.
Mounted body counts identify the new structure, not a direct cache-hit counter.

Historical results remain in the
[pending-creation retention report](endpoint-creation-retention.md) and
[validation-indexing report](endpoint-chooser-indexing.md).

## Results

All values below are p95 milliseconds across the two case orders.

| Policy-enabled case          | Before listener → DOM | After listener → DOM | Before input → rAF | After input → rAF |
| ---------------------------- | --------------------: | -------------------: | -----------------: | ----------------: |
| release-creation-broad       |             19.9–20.4 |            21.0–21.2 |          33.4–34.3 |         33.2–33.3 |
| large-creation-broad         |             45.8–48.2 |            29.3–30.7 |          53.2–55.2 |         36.8–38.1 |
| large-creation-selective     |             44.4–44.5 |            28.3–29.3 |          50.4–50.7 |         34.7–35.5 |
| release-reconnection-broad   |             20.1–21.8 |            21.5–21.7 |          34.0–34.4 |         33.4–33.7 |
| large-reconnection-broad     |             49.6–51.3 |            38.6–38.6 |          54.4–56.3 |         42.5–43.2 |
| large-reconnection-selective |             45.0–45.4 |            35.4–37.0 |          51.8–52.2 |         41.9–43.5 |

The large callback-enabled cases improve in these runs. The three-node release
cases show small listener-time overhead and no clear overall response advantage;
do not promise a gain for every diagram. Callback cost and veto density vary by
host. The installed large-fixture callback has no matching Publish node, as
described above; the release and interaction checks supply actual lock semantics.

| Other browser mode    | Case                         | Listener → DOM | Input → rAF |
| --------------------- | ---------------------------- | -------------: | ----------: |
| default               | release-creation-broad       |      19.1–19.5 |   33.2–33.4 |
| default               | large-creation-broad         |      45.5–45.9 |   52.9–54.3 |
| default               | large-creation-selective     |      44.2–45.5 |   51.6–52.1 |
| default               | release-reconnection-broad   |      19.0–19.6 |   33.3–33.4 |
| default               | large-reconnection-broad     |      48.4–49.5 |   52.8–54.1 |
| default               | large-reconnection-selective |      44.1–45.0 |   50.9–51.2 |
| retained-creation     | large-creation-broad         |      28.4–28.8 |   35.4–36.0 |
| retained-creation     | large-creation-selective     |      27.7–28.0 |   34.0–34.7 |
| retained-reconnection | large-reconnection-broad     |      32.0–32.3 |   36.4–37.0 |
| retained-reconnection | large-reconnection-selective |      27.1–28.0 |   33.6–34.7 |

| Package nodes / targets | Creation resolution | Reconnection resolution |
| ----------------------- | ------------------: | ----------------------: |
| 32 / 64                 |         0.040–0.174 |             0.029–0.040 |
| 320 / 640               |         0.350–0.391 |             0.294–0.298 |
| 1000 / 2000             |         1.297–1.322 |             1.226–1.287 |

The core algorithms are unchanged. Checksums, fixtures, candidate counts and
untimed policy counts match the prior package benchmark. Small-fixture timing
variation is visible; no resolver speedup is claimed in this slice.

Both policy orders preserve graph/option/sample counts and query-direction
balance, with body wrappers changing from zero to one per node. The protected
release input stays disabled and browser interaction reports no page errors.

Raw samples:

- creation-before: [forward](node-body-policy-creation-before-forward.json) · [reverse](node-body-policy-creation-before-reverse.json).
- creation-after: [forward](node-body-policy-creation-after-forward.json) · [reverse](node-body-policy-creation-after-reverse.json).
- reconnection-before: [forward](node-body-policy-reconnection-before-forward.json) · [reverse](node-body-policy-reconnection-before-reverse.json).
- reconnection-after: [forward](node-body-policy-reconnection-after-forward.json) · [reverse](node-body-policy-reconnection-after-reverse.json).
- core: [forward](node-body-policy-core-forward.json) · [reverse](node-body-policy-core-reverse.json).
- default: [forward](node-body-policy-default-forward.json) · [reverse](node-body-policy-default-reverse.json).
- retained-creation: [forward](node-body-policy-retained-creation-forward.json) · [reverse](node-body-policy-retained-creation-reverse.json).
- retained-reconnection: [forward](node-body-policy-retained-reconnection-forward.json) · [reverse](node-body-policy-retained-reconnection-reverse.json).

## Reproduce

Use the original commands for the package/default/retained creation/reconnection
matrix. For policy-enabled runs, after building the sample, run from `apps/web`:

```sh
FLOW_CHOOSER_BENCH_RETAINED=1 FLOW_CHOOSER_BENCH_RETAINED_CREATION=1 FLOW_CHOOSER_BENCH_PORT_POLICY=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/body-creation-forward.json
FLOW_CHOOSER_BENCH_RETAINED=1 FLOW_CHOOSER_BENCH_RETAINED_CREATION=1 FLOW_CHOOSER_BENCH_PORT_POLICY=1 FLOW_CHOOSER_BENCH_REVERSE=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/body-creation-reverse.json
FLOW_CHOOSER_BENCH_RETAINED=1 FLOW_CHOOSER_BENCH_PORT_POLICY=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/body-reconnection-forward.json
FLOW_CHOOSER_BENCH_RETAINED=1 FLOW_CHOOSER_BENCH_PORT_POLICY=1 FLOW_CHOOSER_BENCH_REVERSE=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/body-reconnection-reverse.json
bun - < ../flow-sample/evidence/node-body-policy-check.mjs > /tmp/body-check.json
```

Keep previous raw samples. The driver saves `node-body-policy.png` in this folder.

## Qualification

- Baseline workspace typecheck and lint/format checks: exit 0.
- Final focused retention/composition/diagnostics tests: 22 passed, exit 0.
- Final `bun typecheck` after the identity fix: exit 0.
- Full `bun run test` after the fix: exit 0, including 240 Flow tests and the
  expanded strict Bundler/NodeNext/Node packed-consumer checks.
- Flow TypeDoc regeneration with warnings treated as errors: exit 0.
- Production sample build after shared-wrapper fix: exit 0.
- Browser interaction driver: exit 0, no page errors. Body input editing and Undo
  also work under port protection. [Check](node-body-policy-check.json) ·
  [inspected screenshot](node-body-policy.png).
- Four fresh baseline passes and 12 final follow-up passes: all exit 0.
- Post-run comparison validates fixture/option/sample counts, environment,
  query-direction balance, expected body-wrapper counts and measured-source hashes.
- Final benchmark TypeScript and workspace lint/format/catalog checks: exit 0.

[Source and parent-build manifest](node-body-policy-sources.json) identifies the
measured production files, tests, harnesses and original build bundles.

Architecture self-review: the pure core and document schema stay unchanged;
cache creation/weak slots are confined to the optional FoldKit adapter. Permission
results never enter a slot, and live controls retain reducer validation.
Delivery self-review: new API exports compile/run outside the workspace and
TypeDoc validates; no registry write, PR or hosted/CI activation was performed.
Test self-review: the original missing-body case and real cache-transition
remount were reproduced before fixes. The final browser check waits for changed
port state before asserting actual input identity, rather than relying on focus
restoration alone. Formal screen-reader/device/burst-input qualification was not
performed. Timings have no machine-dependent CI threshold.

Disable `nodeBodyCache` to recover the prior policy fallback; no data migration is
needed. Automatic retention still excludes custom shells and body policies. A
custom shell can be explored next through explicit body inputs and the public
cache/primitives; this slice does not claim automatic retention of arbitrary
custom-renderer contexts.

Recommendation: **needs follow-up** for the custom Orbit shell demonstration.
