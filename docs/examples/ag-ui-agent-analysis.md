# Service Incident Lab

An app-owned AG-UI reference demo at `/agent-analysis`, with a second retained
host at `/agent-analysis/retained`. Its backend is a deterministic synthetic
fixture, not a live agent, production monitoring system or remediation service.

## Useful Outcome

Run analysis to inspect a service latency change against a validated baseline.
The chart uses fixed fixture domains, a clearly illustrative 100ms p95 budget,
and baseline outlines for changed services. Table selection supplies a keyboard
path to the service inspector; local filtering does not restart the stream.

The normal fixture raises API latency from 60ms to 145ms, preserves it through a
reordered snapshot, then adds a fourth service. Counts come from valid records.
Newly added services have no earlier measurement and are labelled New rather
than given a manufactured comparison.

The invalid fixture first accepts the same spike, then attempts an atomic patch
that changes latency to 999ms and removes a missing service. Rejection evidence
is separate from validated measurements: no partial change reaches chart, table
or inspector. The last valid data, baseline and selection remain available.
Restart analysis begins a new normal run requiring its own first valid snapshot;
it is not an in-run resync or resume acknowledgement.

## Ownership

- Astro owns the document, client island and navigation facts. The host retains
  the same island across the two demo routes; it does not store agent state.
- The FoldKit Model owns run identity, first-snapshot baseline, last valid Wire,
  local inspection and bounded rejection/evidence state. Commands/subscriptions
  own side effects; only accepted data is supplied to chart geometry.
- Viz supplies pure Cartesian geometry and parent-owned rendering helpers.
  It has no AG-UI dependency and cannot load data or execute agent work.
- The endpoint validates SDK input and app-owned scenario data, limits actual
  request bytes to 16 KiB and streams SDK-encoded SSE from a request-owned scope.

Each new run retains the previous valid Wire and its matching baseline while
connecting. Its first valid snapshot replaces both. Later snapshots update Wire
without resetting that run's baseline; comparison uses stable service IDs, not
row order. Failed, cancelled and completed runs retain useful measurements.

Cancel stops the active client stream without starting a replacement. Route exit
cancels an active run, retained `stayed` navigation preserves it, and unmount
disposes its scope. Closing HTTP is not proof that a real agent stopped computing.

The supported inbound subset is run start/finish/error plus state snapshot/delta.
Other valid event families are ignored. The demo does not claim full AG-UI client
compliance, automatic retry, a backend run registry or provider integration.

## Local Checks

```sh
bun run --filter @opsydyn/web dev
bun run --filter @opsydyn/web test:e2e
bun run check
bun typecheck
bun run test
```

The two browser files cover real retained navigation, responsive geometry,
keyboard selection, coherent baseline comparisons and invalid-update recovery at
desktop and 390px viewports. They exercise the real local Astro SSE endpoint,
not the visual prototype's fixed state switching.

See the [implementation plan](../superpowers/plans/2026-10-11-ag-ui-agent-analysis.md)
and [qualification record](../superpowers/specs/2026-10-11-ag-ui-agent-analysis-qualification.md)
for current execution evidence. Browser CI, compiled Cloudflare endpoint streaming,
screen-reader acceptance, deployed behaviour and real backend compute cancellation
remain separate qualification gates. The locally qualified and reviewed demo is
committed as `083dff8` and merged into local `main`. The subsequent user approval
authorises pushing this work and the previously reviewed commits; hosted workflow
results are separate from the local qualification evidence.
