# Portable finding navigation qualification

- **result:** complete
- **claim:** the private adapter's portable entry resolves a finding into its
  source-linked node/relation and a scoped, live-checked read-only navigation recipe.
  The workbench composes that recipe into its detached preview and shows native
  Reveal controls, source labels, selected-target feedback and availability reasons.
- **evidence:** five new headless regression tests, 13 adapter tests including packed
  Node/Bun and strict NodeNext/Bundler consumers, 119 workbench tests, root typecheck,
  check/all tests, private pack/publint and production build. Local Chromium keyboard,
  recovery, model-preservation and light/dark captures were inspected. Architecture,
  boundary, implementation and test-quality reviews are **self-review**.
- **remaining uncertainty:** host scope/provenance are not authentication, and hosts
  must supply the matching detached editor and any renderer-specific protection.
  SDK/core publication gates remain unchanged. Other browsers/devices, manual AT,
  hosted/provider execution and arbitrary renderer fidelity remain unobserved.
  Deterministic preview layout can still overlap dense relation labels and nodes.
- **next:** opt-in preview layout using the existing ELK adapter, preserving source
  identity/findings while improving dense-diagram readability. Recommendation:
  **needs review**.

## Package contract and regression evidence

`resolveAlchemyFindingNavigator` returns labels, target identity, immutable requests,
selected feedback and visible reasons. `resolveAlchemyFindingReveal` rechecks scope,
full canonical source content, finding code/source membership, read-only/measured/
idle state, host protection, actual target existence, edge endpoints and core
revealability before returning any events. The request cannot substitute a target
ID or camera position. Source-less, duplicate/unmapped and hidden targets remain
unavailable. Identical revisions with changed topology reject old requests; reorder
and explicit identity aliases retain their meaning. Containment findings reveal a
child node rather than fabricating an edge.

The recipe clears selection, reveals/expands the target, then selects exactly one
node or relation. A targeted regression reproduced failed selection when a group
was collapsed and an unrelated node was hidden: selecting before reveal left no
selection. Reordering the recipe fixed the real core reducer case. The test asserts
selection, ancestor expansion and unchanged graph/past/future; it fails with the
original ordering. Tests also cover scope/content replacement, forged membership,
missing/hidden nodes and relations, mismatched endpoints, host protection, writable
editors, missing measurement, gestures and detached/frozen output records.

Installed portable consumers exercise the actual exported helpers under Node/Bun
and both strict TypeScript profiles, with no SDK/Alchemy/Effect/Foldkit/React
installed. Existing SDK entry consumers and both expected upstream negative compiler
probes remain qualified separately. No source format, package version, release
selection or dependency was changed. Full canonical source identity has a bounded
serialization cost under the host's existing 1 MiB text boundary; no large-diagram
performance or general memory guarantee is claimed.

## Workbench and browser evidence

The workbench generates a fully typed finding-click message from each package
request. Activation uses the current preview and protection reason; source/review
replacement cannot replay an old button. Pending descriptor reads disable finding
navigation with visible reasons. Invalid replacement input retains the previous
review and its valid navigation. The invoking native button retains keyboard focus;
only the detached selection, camera and collapsed-view state change. The working
editor, Undo, editions, lineage, receipts and consent remain unchanged.

Chromium acceptance exercises Enter on node and relation Reveal buttons, focus
retention, exactly one selected target, matching sidebar highlight, Delete rejection,
light/dark and Minimal mode, oversized/invalid input recovery, replacement file
revision and exact canonical working-model equality after close. No page errors or
external network requests were observed. Native disabled reasons are tested at the
package/workbench boundary; manual screen-reader acceptance remains unobserved.

[Browser receipt](alchemy-finding-browser.json) ·
[Reproducible script](alchemy-finding-browser.mjs) ·
[Light node finding](alchemy-finding-light.png) ·
[Dark relation finding](alchemy-finding-dark.png).

Both captures were inspected for neutral/blue family themes, readable source labels,
a visible read-only/return/Fit banner, selected target/card feedback and retained
keyboard focus. Source IDs remain available in native Source fact details rather
than dominating the sidebar. The canvas stays visible while the findings scroll.

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/foldkit-zloz-alchemy pack:check
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/alchemy-finding-browser.mjs
```

All commands exited 0. Existing advisory warnings/skipped tests remain; these are
local checks, not CI, hosted or publication evidence. TypeScript initially caught
an overly narrow mutable-array test helper and a nullable source-ID expectation;
both tests now use the actual owner types. The first sandboxed root typecheck exited 0 but logged a Vite socket-bind EPERM
in the existing web workspace; rerunning that workspace with local socket permission
completed with zero errors, warnings or hints and no socket error. No compiler,
linter or compatibility gate was weakened. See [ADR 0069](../../../docs/adr/0069-reveal-portable-findings-with-scoped-navigation-recipes.md).
