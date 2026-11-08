# Public body-cache composition in Orbit shells

- **result:** complete
- **claim:** custom Orbit nodes/groups compose the public body cache while sockets
  and controls remain live; this simple artwork shows a modest large-creation gain.
- **evidence:** three typed Orbit tests, 240 Flow tests, expanded strict packed
  consumer, workspace gates, TypeDoc/builds, production browser checks, inspected
  screenshot and 16 successful matched benchmark passes.
- **remaining uncertainty:** selective reconnection and the small fixture show no
  clear speedup; large policy fixtures install a callback without matching vetoes.
  Local serial headless timings are not INP or physical-device qualification.
- **next:** add a large protected Orbit scenario with mixed socket policies and
  visible reason badges, so scale qualification includes real vetoes.

## Composition and ownership

The workbench's **Retain node views** switch now chooses cached Orbit node/group
renderers when **Node design → Orbits** is selected. Cards retain their previous
automatic cache options. Orbit composition uses a separate per-canvas
`createFlowNodeBodyCache()` instance; no private bindings or new engine behavior
are introduced.

Node artwork receives `[h, node, selected, selectionPreview]`. Group labels receive
`[h, node]`. These are the values their bodies read. They do not capture a graph,
policy, full renderer context, staged source or control collection. Drag handles,
node/group resize controls, group collapse buttons, frames and native/custom
sockets remain outside the retained artifacts and evaluate current Model context.

Cached and uncached modes use the same body constructors and root shapes. For
Orbits, the automatic whole-node/body options are omitted: the custom shell owns
its explicit composition, avoiding an unnecessary node-layer wrapper transition
when retention toggles. The group and node retain separate body positions under
unique immutable node identities.

The optional package documents this generic public usage and the packed consumer
compiles/runs a custom artwork slot. The cache implementation and pure editor are
unchanged; only the cache's documentation comment broadens from built-in bodies
to explicit custom composition. This follows ADR 0004's existing ownership and
composition decisions, so no new architecture decision or dependency is needed.

## Tests and browser proof

Before implementation, all three new tests failed because the shell ignored the
cache argument. They now pass with a recording slot through the actual FoldKit
view. Assertions cover source/policy-independent artwork keys, current socket
reasons, selection/marquee decoration, group collapse and read-only controls.
The sample has its own typed test script, run by the workspace suite.

The [production browser check](orbit-body-cache-check.json) passed: live handle
focus/identity through cache and policy transitions, native source/protection
feedback, filter focus, connection creation/Undo, keyboard selection/highlight,
pointer drag/Undo, circle resize/measurement/Undo, group collapse/expand and group
resize/Undo. Retained artwork contains no buttons, inputs or sockets.

[Inspected screenshot](orbit-body-cache.png): Review output staged with Publish
input protected. Interaction assertions establish behavior separately from pixels.

## Benchmark method

The existing harness adds `FLOW_CHOOSER_BENCH_ORBITS=1`, which selects the Orbit
shells and waits for Model-owned circular node measurements to match their widths
before installing the timed input probe. Timing instrumentation remains unchanged:
three fresh pages, four warmups and 20 serial trusted inputs per page, with exact
option acknowledgement and the next animation-frame callback. Two case orders
are retained. No concurrent assistant tests/builds run during recorded passes;
OS activity is uncontrolled.

Compare Orbit caching on/off in the **same production build**, with matching
fixtures, policies, viewport and queries. This controls for the added artwork
wrapper, which is present in both modes. Body counts indicate structure, not
measured cache-hit counts. Keep the original historical benchmark evidence intact.

The Publish-input policy flag really locks Publish in the release example. The
large workflow has no Publish node, so it installs/evaluates the same callback
without port vetoes. Large policy-enabled results therefore measure callback
presence, not dense denials or expensive consumer policies. Actual protected
socket semantics are checked in the small fixture and browser journey.

Local serial headless listener-to-options-DOM and input-to-next-rAF results are
not INP, physical paint, burst-input or cross-device qualification. Ranges across
case orders are observations, not confidence intervals or CI timing budgets.

## Results

Measured on 2026-11-08: Apple M4 Pro, arm64, Darwin `25.6.0`, Bun `1.4.4`,
Chromium `151.0.7922.34`. All table values are p95 milliseconds across both case
orders. Uncached/cached rows use the same production build.

| Orbit mode / case                             | Uncached listener → DOM | Cached listener → DOM | Uncached input → rAF | Cached input → rAF |
| --------------------------------------------- | ----------------------: | --------------------: | -------------------: | -----------------: |
| No port policy / large-creation-broad         |               46.1–47.2 |             41.3–43.4 |            53.2–55.8 |          47.3–50.3 |
| No port policy / large-creation-selective     |               44.9–45.2 |             39.3–41.9 |            50.4–50.7 |          45.0–47.6 |
| No port policy / large-reconnection-broad     |               49.3–50.7 |             47.4–49.6 |            54.0–56.2 |          52.1–54.3 |
| No port policy / large-reconnection-selective |               44.6–45.3 |             44.9–44.9 |            50.5–51.3 |          50.7–50.8 |
| Policy enabled / release-creation-broad       |               21.2–22.6 |             22.0–22.1 |            33.6–33.8 |          33.2–33.3 |
| Policy enabled / large-creation-broad         |               46.4–46.5 |             44.3–44.3 |            53.1–53.2 |          50.9–51.6 |
| Policy enabled / large-creation-selective     |               44.7–45.2 |             41.3–41.7 |            50.4–51.3 |          46.9–47.6 |
| Policy enabled / release-reconnection-broad   |               21.6–21.7 |             22.0–22.0 |            33.2–33.4 |          33.3–33.5 |
| Policy enabled / large-reconnection-broad     |               50.8–51.1 |             48.2–48.4 |            56.0–56.7 |          52.6–53.2 |
| Policy enabled / large-reconnection-selective |               44.7–45.2 |             44.1–45.9 |            50.9–51.8 |          50.0–51.8 |

Caching this simple artwork gives a modest large-creation improvement. Broad
reconnection improves less, and selective reconnection ranges overlap. The small
release case shows no clear listener-time advantage. Do not infer a gain for
every shell, device or policy. Keeping controls live and composing the public API
are the functional results; these timings qualify this particular example.

| Card control case            | Listener → DOM | Input → rAF |
| ---------------------------- | -------------: | ----------: |
| release-creation-broad       |      19.2–20.2 |   33.1–33.7 |
| large-creation-broad         |      46.2–46.2 |   53.2–55.3 |
| large-creation-selective     |      44.7–45.4 |   50.9–51.4 |
| release-reconnection-broad   |      19.2–19.8 |   33.5–33.5 |
| large-reconnection-broad     |      49.6–50.7 |   55.0–55.7 |
| large-reconnection-selective |      43.9–44.3 |   50.2–50.7 |

| Package nodes / targets | Creation resolution | Reconnection resolution |
| ----------------------- | ------------------: | ----------------------: |
| 32 / 64                 |         0.035–0.074 |             0.033–0.034 |
| 320 / 640               |         0.268–0.281 |             0.253–0.263 |
| 1000 / 2000             |         0.979–1.300 |             0.880–1.140 |

Package checksums, fixture/candidate counts and untimed policy-call counts match
the previous package benchmark; no resolver optimization is introduced here.
Orbit on/off runs match environment, graph/option counts, body structure and
sample counts, with 30 narrowing and 30 expanding inputs per case/order.

Raw samples:

- core: [forward](orbit-body-cache-core-forward.json) · [reverse](orbit-body-cache-core-reverse.json).
- cards: [forward](orbit-body-cache-cards-forward.json) · [reverse](orbit-body-cache-cards-reverse.json).
- orbit-live: [forward](orbit-body-cache-orbit-live-forward.json) · [reverse](orbit-body-cache-orbit-live-reverse.json).
- orbit-live-policy: [forward](orbit-body-cache-orbit-live-policy-forward.json) · [reverse](orbit-body-cache-orbit-live-policy-reverse.json).
- orbit-cached-creation: [forward](orbit-body-cache-orbit-cached-creation-forward.json) · [reverse](orbit-body-cache-orbit-cached-creation-reverse.json).
- orbit-cached-reconnection: [forward](orbit-body-cache-orbit-cached-reconnection-forward.json) · [reverse](orbit-body-cache-orbit-cached-reconnection-reverse.json).
- orbit-cached-policy-creation: [forward](orbit-body-cache-orbit-cached-policy-creation-forward.json) · [reverse](orbit-body-cache-orbit-cached-policy-creation-reverse.json).
- orbit-cached-policy-reconnection: [forward](orbit-body-cache-orbit-cached-policy-reconnection-forward.json) · [reverse](orbit-body-cache-orbit-cached-policy-reconnection-reverse.json).

## Reproduce

Build with `FLOW_BENCHMARK_SOURCEMAPS=1 bun run --filter @opsydyn/flow-sample build`.
Use the existing core/card commands as controls. From `apps/web`, add the Orbit
flag to the existing cached/uncached creation/reconnection and policy modes:

```sh
FLOW_CHOOSER_BENCH_ORBITS=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/orbit-live.json
FLOW_CHOOSER_BENCH_ORBITS=1 FLOW_CHOOSER_BENCH_PORT_POLICY=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/orbit-live-policy.json
FLOW_CHOOSER_BENCH_ORBITS=1 FLOW_CHOOSER_BENCH_RETAINED=1 FLOW_CHOOSER_BENCH_RETAINED_CREATION=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/orbit-cached-create.json
FLOW_CHOOSER_BENCH_ORBITS=1 FLOW_CHOOSER_BENCH_RETAINED=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/orbit-cached-reconnect.json
bun - < ../flow-sample/evidence/orbit-body-cache-check.mjs > /tmp/orbit-check.json
```

Repeat with `FLOW_CHOOSER_BENCH_REVERSE=1`; add the policy flag to both cached
modes for protected-control comparisons. The browser check saves
`orbit-body-cache.png` alongside its result JSON.

## Qualification

- Baseline workspace typecheck/check: exit 0.
- Three new Orbit tests failed before cache composition, then passed with typed
  test compilation; the workspace test command now includes these sample tests.
- Final application and workspace typechecks: exit 0. An explicit-undefined group
  hook first failed strict optional typing; an omission spread then failed lint.
  The final implementation preserves the original defined callback/fallback pattern.
- Full `bun run test`: exit 0, including 240 Flow tests, three Orbit tests and the
  expanded strict Bundler/NodeNext/Node packed custom-body consumer.
- Flow TypeDoc generation (warnings treated as errors): exit 0.
- Production sample build with source maps: exit 0.
- Browser interaction driver: exit 0, no page errors; screenshot inspected.
- All 16 benchmark passes: exit 0; count, identity and source-hash comparisons pass.
- Final benchmark TypeScript and workspace lint/format/catalog checks: exit 0.

[Measured source manifest](orbit-body-cache-sources.json) records the parent HEAD
and hashes of runtime sources, tests, public contract comment and both drivers.
The JSON HEAD identifies the parent checkout; measurements include the source
edits recorded by these hashes before their commit.

Self-review: no new cache API, engine algorithm, persistence schema, dependency,
permission token or alternate input runtime is introduced. Automatic retention
still excludes complete custom shells; Orbit's explicit composition uses public
primitives and the existing callable cache. Native geometry and control ordering
are unchanged, and cache toggling reuses body constructors to preserve identity.
The tests do not measure cache-hit counters, expensive policies, formal
screen-reader behavior or physical devices. No publishing, PR, hosted deployment
or CI activation was performed. Disable the workbench retention switch to compare
live artwork; no document migration is needed.

Recommendation: **needs follow-up** for a large mixed-policy Orbit scenario with
visible socket reasons, rather than treating a no-veto callback as dense policy
qualification.
