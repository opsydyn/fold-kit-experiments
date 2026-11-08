# Foldkit Zloz promo

Private static Astro site at `apps/zloz-promo`. Uses the selected Nested frame
identity, the Viz/Three family styling, approved product copy and an app-owned
C4 context fixture through the public graph/geometry/Mermaid packages.

## Local review

From the repository root:

```sh
bun install --frozen-lockfile
bun run dev:flow-sample
# Separate terminal; board dev uses 4327:
ZLOZ_WORKBENCH_URL=http://127.0.0.1:4327/ bun run dev:zloz-promo
```

The promo uses port **4329**. Its default workbench link is the existing reviewed
production preview at **127.0.0.1:4323**, rather than the board's dev port. It is
labelled local in the hero. The workbench is a separate process and origin.

For production-build review:

```sh
bun run --filter @opsydyn/zloz-promo build
bun run --filter @opsydyn/zloz-promo preview --host 127.0.0.1 --port 4329
node apps/zloz-promo/evidence/promo-browser.mjs
bunx oxfmt apps/zloz-promo/evidence/promo-browser.json
```

The browser harness uses the installed web workspace's Playwright tooling. Set
`ZLOZ_PROMO_REVIEW_URL` to review a different local preview location. The baseline
harness expects the default local workbench target.

## Configuration and boundaries

Set these at build/dev startup:

| Variable               | Default                  | Purpose                                                                         |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| `ZLOZ_PROMO_BASE_PATH` | `/`                      | Local pages, scripts, fonts, favicon and downloads under a deployment directory |
| `ZLOZ_WORKBENCH_URL`   | `http://127.0.0.1:4323/` | HTTP(S) target for workbench links; this does not deploy the board              |
| `ZLOZ_PROMO_SITE_URL`  | omitted                  | Optional site origin, to be selected during hosting work                        |

No canonical production origin, hosting provider configuration or npm rename is
assumed. The site is not added to the existing Pages deployment. Registry
publication remains a separate, later slice. Current technical imports remain
`@opsydyn/foldkit-flow*` while public product copy says Foldkit Zloz.

The hero is explicitly a **static package-generated preview**, not an interactive
editor. Astro prerenders it from `src/lib/context-model.ts`. Node outlines, port
anchors and connection paths use public core geometry; downloads use canonical
serialization and the optional loss-aware Mermaid exporter. The actual source
module in `src/examples/first-model.ts` supplies the docs snippet, so the displayed
example is typechecked. Native details disclose Mermaid source and all conversion
notes; the bundle includes source, identity metadata and diagnostic losses.

TypeScript examples use the same shared syntax engine, escaped token tree,
line anchors and light/dark stylesheet as Viz and Three. Highlighting is
prerendered with one server engine; no highlighter/WASM is loaded in the browser.

Astro owns the page chrome and its independent `foldkit-zloz-theme` preference.
The separate **Compose** island uses native Foldkit, with package-owned editing
state held in its Model. It demonstrates node/edge selection, native connection
choosers, keyboard/pointer port connections, cancellation, Undo and Redo. Its
camera fits on first measurement; Fit remains available afterward. Wheel input
continues scrolling the page. The vertical fixture keeps text readable on narrow
screens. It is an ephemeral example: reloading starts fresh.

The island uses `lazyApp`, `client:load` and `noMeta`; Astro retains document
metadata. Public `flowView` and connection primitives handle the controls and
scoped input mounts. `createEditor` / `updateEditor` own graph changes and history;
no workbench logic is copied into the promo. CSS variables inherit the page theme
without replacing the live Model. Its actual state/update source is shown with
the shared syntax highlighter.

The static page, C4 preview and downloads still work without JavaScript; editing
and theme switching require it. A noscript message links to the separate
workbench. Self-hosted Inter avoids external font requests. Browser tests cover
saved/system/cross-tab themes, blocked storage and the live Compose island.

The mark/favicon come directly from `docs/assets/zloz/final`, without another
authored logo copy. See [ADR 0012](../../docs/adr/0012-create-a-static-zloz-promo-shell.md)
and [local evidence](evidence/promo.md). The interactive boundary is recorded in
[ADR 0013](../../docs/adr/0013-demonstrate-compose-with-a-native-foldkit-island.md)
and [Compose evidence](evidence/compose.md).

Run `node apps/zloz-promo/evidence/compose-browser.mjs` against the built preview
to exercise chooser, keyboard and pointer connection paths, selection, cancel,
duplicate rejection, history, theme retention, narrow fit and Astro metadata.
Then format `apps/zloz-promo/evidence/compose-browser.json` with oxfmt.

For a nested-path check, build with `ZLOZ_PROMO_BASE_PATH=/preview/zloz/` and
`ZLOZ_WORKBENCH_URL='http://127.0.0.1:4323/?from=zloz'`, using Astro's `--outDir`
option to keep that output separate. Set `ZLOZ_PREFIX_DIST` to that directory and
run `node apps/zloz-promo/evidence/basepath-browser.mjs`. Its temporary HTTP server
serves only the prefix, so missing base paths cannot silently resolve at `/`.
Use the workspace's `build --outDir ...` script for this check, so its package
prebuild runs first. Run build/typecheck/workspace tests sequentially before the
browser proofs; rebuilding shared package output concurrently can interrupt
module resolution in other verification processes.
