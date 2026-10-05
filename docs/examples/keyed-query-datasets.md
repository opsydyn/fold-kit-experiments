# KeyedQuery dataset explorer

The demo at `/dataset-explorer` uses FoldKit 0.166's experimental Query API
with keyed arguments. It demonstrates application-owned remote state around
composable chart geometry and FoldKit layers.

## Try it

1. Select a station. Its first visit fetches observations from `/api/datasets`.
2. Visit another station, then return. The retained snapshot appears immediately
   without another request.
3. Refresh. The state becomes `Refreshing` and the existing chart stays visible.
4. Simulate a failed refresh. `Stale` preserves the chart and permits retry.
5. Run the response race. A slow request starts, the entire Query cache is reset,
   and a fast replacement starts. The newer snapshot is accepted; the old response
   appears as ignored when it finally finishes.

The observations are explicit illustrative fixtures, not live weather data.
Delays make the asynchronous states observable. Snapshot identities come from
the parent Model, not a server counter or external mutable state.

## Composition

- `data.ts` defines dataset identities, request/response codecs and fixture metadata.
- `query.ts` defines the keyed child and its HTTP fetch Effect. Station identity
  is the cache key; revision, latency profile and simulated failure are request
  controls. The generated fetch Command owns the effect execution.
- `model.ts` embeds the generated Query Model schema directly.
- `message.ts` embeds the generated child Message schema directly.
- `update.ts` uses `Query.lift` for loading, refresh, reset and completion folding.
  It records whether a completion changed a pending state into a settled state;
  Query owns generation checking.
- `chart.ts` projects response points using accessor-based `lineGeometry` and
  composes frame, axes, grid, line and point layers. It accepts frame, theme and
  colour overrides. Domains derive from the observations.
- `view.ts` handles all AsyncData states and exposes a raw data table.
- `pages/api/datasets.ts` validates requests at the HTTP boundary and returns
  uncached JSON so revisits demonstrate application caching.

Reset clears all station entries and invalidates old completions. It does not
cancel requests. This example deliberately keeps explicit cancellation out of
its contract; request diagnostics remains the example for interruptible work.

The cache has only three allowed station keys. Query provides no automatic
TTL or per-key eviction here. Its experimental API may change in future releases.

## Verification

Focused tests cover HTTP validation and fixtures, cached revisits, background
refresh, responses after selection changes, out-of-order replacement responses,
stale recovery, chart/data-table rendering and cold-load failure copy.
Qualification completed on 2026-10-05:

- `bun run check`: zero lint warnings/errors; format clean.
- `bun typecheck`: zero errors/warnings/hints.
- `bun run test`: 398 passing tests (Astro 74, Viz 169, promo 37, web 118).
- `bun run build`: packages and both application builds passed.
- Read-only code review found no Critical or Important issues. A misleading
  cold-failure message was corrected and covered by a regression test.
- Browser HTTP flow: North snapshot 1, Coastal snapshot 2, immediate return to
  retained North snapshot 1, refresh to snapshot 3, failed refresh retained
  snapshot 3, race accepted snapshot 6 and ignored the later snapshot 5.
- The browser flow executes the Query HTTP Command, JSON decoding and error
  mapping, beyond the focused tests' controlled completion messages.
- Dark and light appearances were inspected; the original dark preference was
  restored. No runtime warning/error was recorded before the deliberate failure.

Development preview: `http://127.0.0.1:64187/dataset-explorer`. The promo dev
server remains on port 4321.

[Upstream Query guide](https://foldkit.dev/core/query)
