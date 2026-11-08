# Zloz naming migration inventory — 2026-11-08

- **result:** complete
- **claim:** Repository naming surfaces and compatibility boundaries are inventoried, with a staged target naming recommendation. No rename is implemented by this document.
- **evidence:** Tracked-text scan, manifest/export inspection, built-declaration export enumeration, release/hosting configuration and persisted-format source inspection; see the accompanying JSON snapshot.
- **remaining uncertainty:** Candidate npm names and domains are neither availability-checked nor reserved. Registry publication state and hosted redirects have not been independently checked. Proposed technical names and API aliases need a migration implementation decision.
- **next:** Produce the distinct Zloz SVG logo concepts in the shared family header; implement public-facing copy separately from technical compatibility changes.

## Confirmed direction and scope

The user selected **Foldkit Zloz** externally, ASCII `zloz` in technical spellings,
and **Złóż** in the etymology only. Position it as a graph and system modelling
toolkit: Compose, Model, Communicate. The primary tagline is “Compose systems.
Connect ideas.” The [roadmap](../roadmap.md#zloz-brand-and-product-direction--2026-11-08)
records the complete identity; the [shared brief](2026-11-08-zloz-logo-and-site-brief.md)
defines the site/asset direction.

This is an inventory and recommendation, not authorization to publish, deploy,
rename wire formats or rewrite history. The minimum migration preserves existing
models and behavior while making the public-facing identity consistent.

## Measured footprint

[Inventory JSON](2026-11-08-zloz-naming-inventory.json) records the exact base commit,
file list, hit counts, public names and method. The tracked-text pattern is
`foldkit-flow|Fold[Kk]it Flow|flow-sample|/flow/api`. It found **199 files**:

| Classification                    | Files | Treatment                                                         |
| --------------------------------- | ----: | ----------------------------------------------------------------- |
| Packages                          |    20 | Review manifests, exports, docs, build paths and source contracts |
| Applications                      |    24 | Review runtime names, imports, chrome, routes and persistence     |
| Tooling/release                   |    11 | Coordinate pack, CI, Pages and release automation                 |
| Tests                             |    13 | Update active expectations while retaining compatibility fixtures |
| Active documentation              |     5 | Update canonical guides and links deliberately                    |
| Isolated spike                    |     9 | Refresh consumer paths/lock only with deliberate requalification  |
| Historical/qualification material |   117 | Preserve provenance; not mass-replacement targets                 |

These are candidate references, not an exhaustive count of every generic `Flow`
identifier. Historical material alone accounts for most matching files. Newly
written planning documents are outside the snapshot's base commit.

Built declaration exports include both types and values; aliases can repeat
across subpaths:

| Current entry                             | Exports | Flow/flow/createFlow-prefixed |
| ----------------------------------------- | ------: | ----------------------------: |
| `@opsydyn/foldkit-flow`                   |     126 |                            33 |
| `@opsydyn/foldkit-flow/foldkit`           |     142 |                           133 |
| `@opsydyn/foldkit-flow-elk`               |       2 |                             0 |
| `@opsydyn/foldkit-flow-force`             |       2 |                             0 |
| `@opsydyn/foldkit-flow-force/eligibility` |       1 |                             0 |
| `@opsydyn/foldkit-flow-mermaid`           |      11 |                             0 |

All four packages also export `./package.json`. The JSON lists individual names;
counts are not unique cross-package symbol totals. The TypeScript checker read
built declarations, not a regex guess at the public API.

## Proposed target names

These are **recommended candidates**, not registry claims. Keeping `foldkit-`
maintains the existing package-family convention and separates product identity
from generic graph terminology.

| Current                                              | Recommended target                                  | Boundary                                                                      |
| ---------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `@opsydyn/foldkit-flow` / `packages/foldkit-flow`    | `@opsydyn/foldkit-zloz` / `packages/foldkit-zloz`   | Pure core; retain optional `/foldkit` entry                                   |
| `@opsydyn/foldkit-flow-elk`                          | `@opsydyn/foldkit-zloz-elk`                         | Matching core peer; layout implementation remains optional                    |
| `@opsydyn/foldkit-flow-force`                        | `@opsydyn/foldkit-zloz-force`                       | Retain `/eligibility` and separate Viz dependency                             |
| `@opsydyn/foldkit-flow-mermaid`                      | `@opsydyn/foldkit-zloz-mermaid`                     | Export-only optional adapter; no parser adoption                              |
| `@opsydyn/flow-sample` / `apps/flow-sample`          | `@opsydyn/zloz-demo` / `apps/zloz-demo`             | Evolve the existing workbench into the full demo                              |
| No Zloz promo workspace                              | `@opsydyn/zloz-promo` / `apps/zloz-promo`           | Separate static product site using family styling                             |
| Main reference route `/flow`                         | `/zloz`                                             | Keep the old route reachable during migration                                 |
| Published API path `/fold-kit-experiments/flow/api/` | `/fold-kit-experiments/zloz/api/` initially         | Keep old path/fragments reachable; final domain routing is a hosting decision |
| `dev:flow-sample`                                    | `dev:zloz-demo`, plus a temporary old command alias | Avoid breaking existing local workflows                                       |

Adapter directory names follow the corresponding package basenames. Do not move
files before updating all workspace links, package repository/homepage metadata,
build filters, lockfiles and artifact expectations together.

## Surface-by-surface migration rules

| Surface and observed owners                                                                                                      | Recommended treatment                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App copy: `apps/flow-sample/src/pages/index.astro`, `src/editor/view.ts`, `workbench-layout.ts`; `apps/web/src/pages/flow.astro` | First implementation slice: Zloz headings, document titles, accessible brand labels and site metadata. Preserve behavior and current technical package names initially.                                                                                                                                                            |
| Package metadata: four `package.json` files, root `bun.lock`, app workspace dependencies                                         | Rename as one coordinated technical slice after candidate-name checks. Keep core/adapters version-compatible and regenerate the lock.                                                                                                                                                                                              |
| Public types and helpers: `FlowGraph`, `FlowNode`, `FlowError`, `flowView`, `flowPort`, `createFlowNodeBodyCache`, etc.          | Prefer additive `ZlozGraph`, `ZlozNode`, `ZlozError`, `zlozView`, `zlozPort`, `createZlozNodeBodyCache` aliases before removing old names. Use the JSON export inventory to enumerate the complete set. Preserve runtime identity, especially error constructors and caches; do not fork implementations.                          |
| Generic APIs: `createEditor`, `updateEditor`, `createArchitectureNode`, `createElkLayout`, `createForceLayout`, `exportMermaid`  | Keep meaningful domain names. A rebrand does not require prefixing every function.                                                                                                                                                                                                                                                 |
| Wire data: `packages/foldkit-flow/src/graph.ts`, architecture fixtures                                                           | Keep version-1 graph/snapshot fields and user data unchanged. Graph JSON contains `version: 1`, not a marketing product-name field.                                                                                                                                                                                                |
| Mermaid bundle: `packages/foldkit-flow-mermaid/src/index.ts`                                                                     | Keep `foldkit-flow-mermaid/v1`, identity version 1, optional hierarchy fields and diagnostic codes readable. A future protocol spelling needs explicit old-reader support and a format decision; a package rename alone is not a wire migration.                                                                                   |
| Local storage: `apps/flow-sample/src/editor/command.ts`, `theme.ts`, shell inline theme script; reference app commands           | Preserve `opsydyn.foldkit-flow.release-sample.v1` and `opsydyn.foldkit-flow.color-scheme.v1` reads. Also preserve the reference app key `opsydyn.foldkit-flow.demo.v1`. If new keys are introduced, validate new data, fall back to valid legacy data, and retain originals. Keep first-paint shell and runtime lookup consistent. |
| CSS/DOM hooks: `--flow-*`, `.foldkit-flow`, `data-flow-*`; private Mount/message names                                           | Preserve existing hooks initially. Theme variables are a styling contract; changing them needs aliases/precedence tests. Native input attributes are an interaction protocol, not public-facing brand copy.                                                                                                                        |
| Downloads: `foldkit-flow.json`, `foldkit-flow.mermaid.json`                                                                      | New suggested filenames can use `zloz`, while import remains content/schema based and existing files remain readable. Do not rewrite user labels or data.                                                                                                                                                                          |
| Bench environment: `FLOW_BENCHMARK_SOURCEMAPS`, evidence scripts and tarball paths                                               | Update active tooling together, retaining an explicit old environment alias if renamed. Requalify changed artifacts; do not relabel old benchmark measurements.                                                                                                                                                                    |
| Documentation: root/package/sample READMEs, `docs/flow-api.md`, release guide, TypeDoc config/readme                             | Update current navigation and preferred examples after aliases exist. Preserve subpaths and old-fragment navigation; document deprecations.                                                                                                                                                                                        |
| Historical receipts, ADRs, screenshots and source fingerprints                                                                   | Preserve original names/bytes and commit identity. Retain archive paths or use commit-pinned links when moving runtime directories. New evidence gets a new receipt.                                                                                                                                                               |
| Isolated Mermaid spike                                                                                                           | Its `package.json` and independent npm lock point at an exact old core tarball. Moving/renaming the package requires a deliberate dependency/lock refresh and rerun; do not edit captured evidence to pretend the new artifact was tested.                                                                                         |

If old npm packages need compatibility wrappers, establish actual publication and
consumer requirements first. Use thin re-exports of one canonical implementation,
not two maintained engines. New-package imports must not auto-install a second
legacy core through an obsolete peer declaration. Code examples can prefer new
aliases while legacy aliases remain tested for the agreed compatibility period.
No removal deadline is selected by this inventory. Legacy-key lookup only works
within the same browser origin; a new Cloudflare origin needs an explicit export/
import or separately designed transfer path, not a promise of automatic recovery.

## Release and route findings

1. `release-please-config.json` and `.release-please-manifest.json` include core,
   ELK and force, but **not Mermaid**. The linked group has three components.
2. `.github/workflows/publish.yml` offers those three packages and uses
   `startsWith(inputs.package, 'foldkit-flow')` to select qualified tarball
   publishing. Renaming only the selector would bypass that family path and
   reach the generic publishing branch. Update selection/build/qualification/
   packing as one reviewed change; do not activate publication in a copy-only slice.
3. CI and `tools/pack-flow.ts` already include **all four** packages. Their filters,
   manifest lookup, tarball basenames and clean-consumer fixtures must move together.
4. Core `typedoc.json` includes core, FoldKit, ELK and force/eligibility, but
   **omits Mermaid**. Bring the public API catalogue up to date during docs migration.
5. `.github/workflows/pages.yml` copies generated docs to `_site/flow/api/`.
   Runtime links in the sample, `docs/flow-api.md`, README navigation and page
   build destinations all need a common canonical target. Preserve old links:
   use real HTTP redirects where supported and a documented static fallback
   otherwise; do not call a static fallback an HTTP 301.
6. `tools/check-flow-architecture-compat.ts` checks historical Git trees at
   `packages/foldkit-flow/src`. Preserve that historical path separately from
   any new current-checkout path. A global path replacement would invalidate
   the backwards-compatibility audit itself.
7. Root scripts, `apps/web/package.json`, the reference `/flow` app, the sample's
   prebuild chain, `.gitignore` and package `tsconfig`/TypeDoc relative paths all
   participate. Renaming a directory is not just changing its manifest.

## Bounded implementation sequence

1. **Public brand copy and assets:** product titles, metadata and preferred
   terminology; select the new logo from the shared brief. Keep imports/wire data stable.
2. **API naming bridge:** add reviewed aliases, update examples and generated docs,
   and test old/new runtime identity plus Bundler/NodeNext resolution.
3. **Atomic package/workspace rename:** all four packages, peers, locks, tools,
   active tests and release metadata. Keep publication disabled until its own slice.
4. **Routes and app promotion:** move/evolve the demo, introduce the promo shell,
   preserve old URLs and stored drafts/preferences, and record new visual evidence.
5. **Cloudflare hosting qualification:** isolate the new site's infrastructure,
   preview/prod state and domain from Tech Radar. Then complete publication readiness.

Acceptance for migration: literal old saved fixtures still load; old/new aliases
share behavior and constructors; custom theme hooks work; named ports/groups and
Mermaid metadata survive; active tarballs install and run in Node/Bun; public URLs
and type links resolve; the sidebar/Undo/browser journeys still pass. Registry
availability, actual publication and hosted acceptance are separate evidence.

## Reproduction and review

The JSON search snapshot uses `git ls-files` and the stated pattern over text files.
Public names use TypeScript `getExportsOfModule` on the six built declaration
entrypoints. Reproduce broad discovery with `rg -l 'foldkit-flow|Fold[Kk]it Flow|flow-sample|/flow/api'`
over the scoped owners above; it can also find these newly written notes, which
are intentionally outside the earlier snapshot.

This is a documentation-only planning slice. Architecture/delivery self-review
found no need to change existing runtime boundaries. Recommendations require a
future implementation ADR where they change public contracts. No new dependency,
registry check, logo asset, site or infrastructure was created here.

Local verification: `bun run test`, `bun typecheck` and `bun run check` exited 0.
Relative source links and JSON/category/export totals were checked. No behavior
tests were added for this documentation-only change. This is an agent-maintained
repository inventory and self-review, not independent review or hosted evidence.

Recommendation: **needs follow-up** for the staged implementation; the inventory is complete.
