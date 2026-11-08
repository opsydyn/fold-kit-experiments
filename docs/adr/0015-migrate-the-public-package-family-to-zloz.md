# ADR 0015: Migrate the public package family to Zloz

## Status

Accepted for the user's naming cleanup, 2026-11-08. Supersedes the temporary
technical-name deferral in ADRs 0011–0014 and the naming inventory.

## Decision

Rename the four graph packages to `@opsydyn/foldkit-zloz`, `-elk`, `-force` and
`-mermaid`, move their workspace directories and migrate consumers, tarball
checks, release components and deployment inputs together. Move the full
workbench to `apps/zloz-demo`; canonical API docs live at `/zloz/api/` with title
**Foldkit Zloz API**. Include Mermaid in the generated reference and linked
release family. No Flow-named package release is permitted. Close obsolete
release PR #110; never merge it to complete this migration.

Prefer `Zloz*`, `zloz*` and `createZloz*` APIs. Retain deprecated aliases to the
same implementation for existing source code, with canonical names in examples
and generated documentation. This does not create old npm package wrappers.
Versions remain local candidates; generated `0.2.0` release proposals were not
published releases. Do not publish npm packages or manufacture legacy tags.

Preserve graph version 1, Mermaid bundle `flowId` fields and
`foldkit-flow-mermaid/v1`, browser storage keys, `data-flow-*` input attributes
and `--flow-*` theme hooks. They are compatibility protocols, not product copy.
Both old and new root CSS classes identify the same view. Preserve the old API
entry route as a static compatibility copy, and redirect `/flow` to `/zloz`.
Historical captured evidence and the pinned parser spike retain their original
identities; do not rewrite recorded hashes or claim new artifacts were measured.

## Boundaries and alternatives

Boundary review: **safe with noted risk**. The headless graph and Mermaid export
remain pure, layout engines remain optional, and apps retain Model/lifecycle/
persistence ownership. No runtime dependency is added. The main risk is missing
a package path or accidentally renaming a serialized field. Literal old-model,
alias-identity, packed-consumer, TypeDoc and browser checks cover those boundaries.

A copy-only rebrand would leave users importing and releasing the wrong name.
A blind global replacement would invalidate stored bundles and historical
qualification. Two independently maintained cores would split identity and Undo
behavior. Use one renamed implementation with explicit compatibility surfaces.

The production CLI will use **Effect CLI** (`effect/cli` in the installed Effect
4 contract), typed command/flag/argument definitions, Schema decoding, typed
errors and scoped platform services. Keep process I/O and runtime execution at
the CLI boundary; do not add Effect to the pure Mermaid exporter merely to
replace loops. The isolated parser/CLI fidelity spike is archived research,
not the production CLI implementation. See the roadmap for that subsequent slice.

## Verification and recovery

Self-review architecture, delivery and test roles: check dependency direction,
all four release identities, legacy wire/storage invariants, alias identity,
package exports in clean Node/Bun consumers, generated docs and live interactions.
Run repository lint/format, typecheck, tests, builds and TypeDoc before completion.
Recover unpublished source through a normal revert; never publish old-name
compatibility packages or rewrite historical release artifacts as rollback.
