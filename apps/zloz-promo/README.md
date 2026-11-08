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
There is no graph editing state, copied workbench logic, or browser graph bundle.
The page and downloads work without JavaScript; theme switching uses a small
local script. Self-hosted Inter avoids external font requests. Browser tests cover
saved/system/cross-tab themes and blocked storage.

The mark/favicon come directly from `docs/assets/zloz/final`, without another
authored logo copy. See [ADR 0012](../../docs/adr/0012-create-a-static-zloz-promo-shell.md)
and [local evidence](evidence/promo.md).

For a nested-path check, build with `ZLOZ_PROMO_BASE_PATH=/preview/zloz/` and
`ZLOZ_WORKBENCH_URL='http://127.0.0.1:4323/?from=zloz'`, using Astro's `--outDir`
option to keep that output separate. Set `ZLOZ_PREFIX_DIST` to that directory and
run `node apps/zloz-promo/evidence/basepath-browser.mjs`. Its temporary HTTP server
serves only the prefix, so missing base paths cannot silently resolve at `/`.
