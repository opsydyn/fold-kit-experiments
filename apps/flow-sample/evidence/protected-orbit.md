# Protected Orbit workflow qualification

Measured locally on 2026-11-08. This completes the previous body-cache slice's
follow-up: a 320-node, 452-edge Orbit fixture with **140 real socket vetoes**, not
merely an installed callback that never matches the large graph.

## Behavior and ownership

Open **Open protected Orbit workflow (320 nodes)** in the workbench. It enables
Orbit shells, public body-cache composition, custom sockets, fixture policies and
visible socket reasons. Eighty inputs require approval; sixty outputs are
reserved for automation. Twenty nodes have both guards. Existing authored edges
are preserved; the policies govern newly chosen connection endpoints.

Fixture JSON metadata and the policy lookup belong to the sample. Enforcement,
creation/reconnection preflight, native port semantics, cancellation and Undo use
the existing public package APIs. No new package engine or cache API is needed.
The lookup is rebuilt from current graph metadata when resolving the policy;
it does not cache permissions. Existing manual locks take precedence.

**Apply fixture socket policies**, **Visible socket reasons**, and **Retain node
views** are independent controls. Hiding badges preserves enforcement. Changing
the fixture policy cancels a pending creation source. Badges are live native port
children with accessible descriptions, outside retained artwork. Minimal mode
preserves these semantic protection reasons. Read-only sockets can also display a
read-only reason. Turning off custom sockets uses the package's default ports.

## Evidence

- Four new typed sample tests cover fixture/codec fidelity, exact veto counts,
  preflight/commit agreement, policy relaxation, cancellation, Undo, preset flags
  and SSR descriptions in minimal mode. The sample now has seven tests.
- The [production browser journey](protected-orbit-check.json) checks both reason
  types, disabled choices, independent controls, live handle focus/identity,
  allowed creation, creation after relaxing guards, Undo and minimal mode. No page
  errors were observed. This is native semantic/browser evidence, not a formal
  screen-reader or device audit.
- Inspected [detail screenshot](protected-orbit.png) and
  [full overview](protected-orbit-overview.png). The detail is obtained through
  normal Ctrl-wheel zoom, without changing graph state or CSS for the capture.
- Workspace `bun typecheck`, `bun run check` and `bun run test` pass. Lint emits advisory warnings, including state-style suggestions in test/driver
  code; the check exits zero.
- Source-mapped production build and all six browser benchmark passes succeed.
  The pure package chooser benchmark is rerun in both orders as a control.

## Matched cache comparison

Apple M4 Pro, arm64, Darwin 25.6.0, Chromium 151.0.7922.34. Same production build,
1280×1100 viewport, unthrottled CPU. Each case/order has three fresh pages, four
warmups/page, twenty serial trusted inputs/page: thirty narrowing and thirty
expanding samples. Every page asserts 140 disabled sockets and 140 rendered
reasons before measurement. Candidate/option counts and body structure match
between cache modes. No assistant builds/tests run concurrently with recordings;
other OS activity is uncontrolled.

P95 milliseconds, range across forward/reverse case order:

| Case                         | Live listener → DOM | Cached listener → DOM | Live input → rAF | Cached input → rAF |
| ---------------------------- | ------------------: | --------------------: | ---------------: | -----------------: |
| large-creation-broad         |           45.7–46.0 |             44.7–45.0 |        54.1–54.2 |          53.0–53.6 |
| large-creation-selective     |           46.4–46.4 |             46.4–46.7 |        50.7–50.8 |          51.1–51.7 |
| large-reconnection-broad     |           57.6–58.6 |             50.6–58.8 |        68.9–72.1 |          57.7–70.9 |
| large-reconnection-selective |           56.1–56.4 |             42.7–51.8 |        63.3–63.5 |          49.9–59.5 |

Broad creation shows a small gain. Selective creation shows no gain. Reconnection
has substantial between-order variation; selective reconnection is lower in both
recordings, but these two orders do not establish a reliable general speedup.
The functional outcome is live policy feedback with retained artwork. These are
DOM acknowledgement/next-animation-frame measurements, not INP, physical paint,
burst-input performance or confidence intervals. No CI timing budget is added.

The legacy `portPolicyEnabled` benchmark field refers only to the separate
Publish-input toggle. Here it is false; **protectedOrbit: true** activates the
metadata policies, with the explicit 140/140 counts proving actual vetoes.

Raw samples:

- Live: [forward](protected-orbit-live-forward.json), [reverse](protected-orbit-live-reverse.json).
- Cached creation: [forward](protected-orbit-cached-creation-forward.json), [reverse](protected-orbit-cached-creation-reverse.json).
- Cached reconnection: [forward](protected-orbit-cached-reconnection-forward.json), [reverse](protected-orbit-cached-reconnection-reverse.json).
- Pure package control: [forward](protected-orbit-core-forward.json), [reverse](protected-orbit-core-reverse.json).
- [Source manifest](protected-orbit-sources.json): parent HEAD plus source hashes;
  measurements include the recorded working-tree implementation before commit.

## Reproduce

Build at the repo root:

```sh
FLOW_BENCHMARK_SOURCEMAPS=1 bun run --filter @opsydyn/flow-sample build
bun packages/foldkit-flow/bench/choosers.ts > /tmp/protected-core.json
```

From `apps/web`:

```sh
bun - < ../flow-sample/evidence/protected-orbit-check.mjs > /tmp/protected-check.json
FLOW_CHOOSER_BENCH_PROTECTED_ORBITS=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/protected-live.json
FLOW_CHOOSER_BENCH_PROTECTED_ORBITS=1 FLOW_CHOOSER_BENCH_RETAINED=1 FLOW_CHOOSER_BENCH_RETAINED_CREATION=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/protected-create.json
FLOW_CHOOSER_BENCH_PROTECTED_ORBITS=1 FLOW_CHOOSER_BENCH_RETAINED=1 bun - < ../flow-sample/evidence/endpoint-chooser-benchmark.mjs > /tmp/protected-reconnect.json
```

Repeat benchmarks with `FLOW_CHOOSER_BENCH_REVERSE=1`. The browser driver writes
both PNGs alongside its script. No PR, publication, hosted or CI claim is made.

Next: plan first-class architecture semantics, shapes and patterns in the package,
with C4 and DDD presets demonstrated through the same public composition APIs.
