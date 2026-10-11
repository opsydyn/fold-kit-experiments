# AG-UI / FoldKit Feasibility Spike

## Decision

Proceed with an app-owned reference example, not a new public adapter package
yet. An isolated consumer successfully streamed validated chart data into a
single FoldKit Model using the published Astro and Viz packages. Neither
package needed an API change or an AG-UI dependency.

AG-UI is an agent/application event protocol, not a chart-description format.
The application still owns its data schema, chart choice and interaction policy.
See the [protocol introduction](https://docs.ag-ui.com/introduction).

## Tested Consumer

The throwaway prototype lives at `/tmp/foldkit-agui-spike`, outside the workspace,
with its own manifest and lockfile. It uses registry packages, not source aliases:

- `@opsydyn/astro-foldkit` 0.8.1 and `@opsydyn/foldkit-viz` 0.11.0.
- FoldKit 0.167.0, Effect 4.0.0 and Astro 7.2.8.
- `@ag-ui/client`, `@ag-ui/core` and `@ag-ui/encoder` 1.0.2.
- `fast-json-patch` 3.1.1 for RFC 6902 application and validation.

Review at <http://127.0.0.1:4361> while its local dev server is running.
Run sample streams services into a latency/volume scatter chart. Run invalid
patch demonstrates rollback and snapshot recovery. Run slow sample allows
cancellation after the first snapshot. Table buttons provide keyboard selection;
series filtering remains local while remote data changes.

The mock HTTP/SSE endpoint runs in Vite development middleware. The static build
does not deploy that endpoint. This is deterministic protocol evidence, not a
live agent, authenticated backend or production deployment.

## Ownership Boundaries

1. The app-owned transport uses the AG-UI client's low-level HTTP/SSE decoder,
   without introducing `HttpAgent`'s mutable state store as a second authority.
2. A scoped FoldKit subscription emits typed message facts. Its Effect scope
   owns the fetch AbortController and observable subscription cleanup.
3. The Model separates remote `wire` data from local filter, selected record ID,
   run lifecycle and recovery state. Only the active locally owned run accepts
   incoming events; late events from cancelled or replaced runs are ignored.
4. Snapshots and patched candidates are decoded through Effect Schema. IDs must
   be unique; numeric measurements must be finite and non-negative.
5. Deltas apply to a clone, never the current Model. Any patch or schema failure
   retains the last valid chart and blocks further deltas until a valid snapshot
   establishes a fresh baseline. Applying later patches to a rejected baseline
   would risk silent divergence.
6. Viz receives ordinary validated records and renders through the parent-owned
   HtmlBuilder. Selection follows stable IDs through reorder and is reconciled
   when records are removed or filtered out.

The protocol's snapshot/delta semantics are documented in
[Shared State](https://docs.ag-ui.com/concepts/state). State events do not carry
the run identity used by lifecycle events, so the transport adds its own local
connection identity to message facts. See the
[event definitions](https://docs.ag-ui.com/sdk/js/core/events).

Astro owns embedding and lifecycle facts; the app owns stream policy. Viz owns
geometry and rendering, not agent state, transport or cancellation. These
boundaries preserve both packages' independent skills and consumers.

## Verification

- 11 consumer tests passed with 47 assertions: immutable updates, atomic patch
  rollback, prototype-path rejection, schema validation, snapshot recovery,
  local interaction preservation, stale-run rejection and lifecycle ordering.
- Transport tests exercised real local HTTP/SSE, fragmented UTF-8, HTTP errors,
  premature stream closure and interruption closing the request without restart.
- Astro diagnostics reported zero errors, warnings or hints; the static build
  completed successfully.
- Headless Chrome acceptance passed at 1365px and 390px: streamed marks, keyboard
  selection, filter persistence, reorder identity, malformed-patch recovery,
  cancellation with mock disconnect evidence, and no replacement request.
  No page exceptions, application console errors or document overflow occurred.
- Desktop and mobile screenshots were inspected. Narrow charts and tables use
  intentional horizontal scrolling, not automatically resized geometry.
- Repository checks passed: lint/format, workspace typecheck and 593 tests, with
  one existing promo test skipped. No package source was changed by the spike.

Consumer commands are `bun run test`, `bun run check`, `bun run build` and
`bun run dev` in the temporary directory. Its `check` means Astro diagnostics,
not lint. Browser harness: `/tmp/foldkit-agui-browser.mjs`; screenshots:
`/tmp/foldkit-agui-evidence`. These local artifacts are temporary, not CI fixtures.

The built JavaScript assets totalled 516,067 bytes, or 148,155 bytes gzip when
compressed individually. This includes FoldKit, Effect, Viz and AG-UI; it is not
a measurement of incremental AG-UI overhead against a control build.

## Limits And Next Slice

The probe covers lifecycle and state event subsets, not full AG-UI compliance,
chat rendering, frontend tools, interrupt/resume, reconnection or bidirectional
shared-state conflict handling. Request SSR, retained navigation, screen-reader
use and automatic chart resizing were not qualified here.

Client abort proves transport cleanup, not cancellation of a live agent's
compute. The mock explicitly handles disconnects; a real backend needs its own
cancellation contract. The probe waits for a fresh snapshot after rejecting a
patch, but does not implement an outgoing resynchronisation request.

The next bounded slice should promote one reference example into `apps/web`:

- [ ] Retain deterministic SSE fixtures and browser acceptance in CI.
- [ ] Add an explicit resync request/acknowledgement and reconnect policy.
- [ ] Project approved local filter/selection context into outgoing run input.
- [ ] Verify a backend cancellation acknowledgement and route-exit cleanup.
- [ ] Compare decoder bundle cost against a no-AG-UI control build.
- [ ] Reassess a separate FoldKit adapter only after a second consumer exposes
      genuinely shared transport and lifecycle contracts.

None of these follow-up implementation items is included in this spike.
