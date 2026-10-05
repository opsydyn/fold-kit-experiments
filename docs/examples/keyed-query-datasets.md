# KeyedQuery dataset explorer

The demo at `/dataset-explorer` and promo at `/examples/datasets/` use FoldKit 0.166's experimental Query API
with keyed arguments. It demonstrates application-owned remote state around
composable chart geometry and FoldKit layers. Both apps consume the private
`@opsydyn/dataset-explorer` workspace; the public Viz package stays independent
of application state and HTTP transport.

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

## Promo source panel

The promo fetches prerendered `/datasets/{station}.json` files. Its Query Command
simulates latency and deliberate failures locally; the site needs no server API.
The web demo still uses its HTTP API for latency and failures.

The source selector displays the shared TypeScript and CSS files used by the
running example, read directly by Vite at build time. `snapshot.json` is derived
from the selected Query entry in the Model. It updates after accepted completions
and preserves the current data while refreshing or stale. The panel is a source
viewer; it does not compile edited code.

## Standalone download

The promo page offers `/downloads/dataset-explorer.zip`, generated during the
static Astro build. Extract it, run `npm install`, then `npm run dev` (Bun also
works). `npm run typecheck`, `npm run build` and `npm run preview` are available.

The starter opens on North station and includes all three JSON fixtures, the
maintained native FoldKit app, source viewer and browser light/dark styles.
Compiled Viz modules and declarations are vendored with the current package
version and licence, so the starter needs neither this monorepo nor a newer npm
publication. The download contains the starter rather than the current session's
request history.

## Composition

Core files live in `packages/dataset-explorer/src/`.

- `data.ts` defines dataset identities, request/response codecs and fixture metadata.
- `query.ts` defines the keyed child and its HTTP fetch Effect. Station identity
  together with transport is the cache key; revision, latency profile and simulated failure are request
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
- `source.ts` derives the current source content; `source-view.ts` renders the panel.
- `pages/api/datasets.ts` validates requests at the HTTP boundary and returns
  uncached JSON so revisits demonstrate application caching.

Reset clears all station entries and invalidates old completions. It does not
cancel requests. This example deliberately keeps explicit cancellation out of
its contract; request diagnostics remains the example for interruptible work.

Each app uses only three allowed station keys for its transport. Query provides no automatic
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

Development preview: `http://127.0.0.1:64187/dataset-explorer`. Promo preview: `http://127.0.0.1:4321/examples/datasets/`.

[Upstream Query guide](https://foldkit.dev/core/query)

### Promo integration qualification (2026-10-05)

- `bun run check`: zero lint warnings/errors; format clean.
- `bun typecheck`: zero diagnostics across all five workspaces. The shared package
  also passed its standalone typecheck after adding its Viz build prerequisite.
- `bun run test`: 403 passing tests (Astro 74, Viz 169, promo 42, web 118).
- `bun run build`: both apps passed; all three static JSON fixtures and the
  dataset page were generated. The page contains the shared running source.
- Read-only review: no remaining Critical, Important or Minor findings.
- Native browser flow on port 4321: North snapshot 1, Coastal snapshot 2,
  immediate retained North snapshot 1, refresh to snapshot 3, failed refresh
  preserving snapshot 3, race accepting snapshot 6 and ignoring snapshot 5.
  `snapshot.json` stayed aligned with the selected chart throughout.
- Actual Query source selection, the gallery link, dark/light appearances and
  the original web API consumer were inspected. The dark preference was restored;
  no browser warning/error was recorded. Temporary QA tabs were closed.

### Standalone export qualification (2026-10-05)

- `bun run check`, `bun typecheck`, `bun run test` and `bun run build` passed.
  Tests: 404 total (Astro 74, Viz 169, promo 43, web 118), including independent
  npm installation, typechecking, building and inspection of all three fixtures.
- The browser download link delivered a valid ZIP. Its app sources matched the
  maintained shared files; the vendored package recorded Viz 0.10.0.
- The delivered archive was independently extracted, installed, typechecked and
  built. Its production preview loaded the chart and running source, switched
  to Coastal snapshot 2, returned to retained North snapshot 1, preserved that
  snapshot after failure, accepted race snapshot 5 and ignored snapshot 4.
- Browser light/dark preferences were inspected through temporary media
  emulation, which was reset. No warning/error was recorded. The promo button's
  divider overlap was corrected. QA tabs and the temporary preview were closed.
- Read-only code review found no Critical, Important or Minor issues.
