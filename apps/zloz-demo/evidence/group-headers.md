# Explicit group-header envelope qualification

- **result:** complete
- **claim:** package layout requests and native C4/DDD group renderers can share
  declared header bounds, padding and gap. Core rejects results that fail to reserve
  group minima or place direct children inside the declared content area.
- **evidence:** two new core contract/atomicity tests, C4/DDD rendering/collapse
  regressions, eleven real-engine ELK tests including nested/empty, wide/tall and
  cross-boundary-edge cases; workbench actual-layout/cancellation/source checks;
  installed tarball runtime/strict-type qualification. Root typecheck, check, full
  tests and production build. Local browser rectangle/gap checks in both directions
  and inspected light/dark/native-zoom captures. Architecture, boundary, delivery
  and test-quality reviews: **self-review**.
- **remaining uncertainty:** declarations must match artwork and reserve separate
  controls explicitly. Arbitrary edge/overflow collisions, automatic group-heading
  measurement, other engine versions, large-graph performance, other browsers,
  manual AT and hosted acceptance remain unqualified. SDK/publication gates remain.
  Nothing was pushed, published, deployed or activated.
- **next:** opt-in measured group-heading bounds using the scoped measurement and
  freshness pattern. Recommendation: **needs review**.

## Package contract and boundaries

[ADR 0073](../../../docs/adr/0073-declare-group-header-layout-envelopes.md) records the
decision. `LayoutGroupHeader` declares an existing group ID, header size, four
paddings and gap. IDs are unique; dimensions are positive finite numbers; padding
and gap are nonnegative finite numbers. `layoutRequest` copies nested records and
preserves legacy shape when hints are omitted. `resolveLayoutGroupHeader` computes
the world rectangle, minimum group size and child padding. Overflow is rejected.
Before any publication, core checks every requested group and direct child,
including nested group rectangles. Current invalid results fail atomically; stale
results retain existing ignore behavior. Normal application remains one Undo and
read-only preview application preserves past/future. Hints do not enter graph,
source, history or export wire formats. Hosts share immutable settings with the
renderer and supersede/cancel layout when settings change.

ELK receives padding plus MINIMUM_SIZE. A failing real-engine regression reproduced
transposed compound minima in DOWN on pinned elkjs 0.12.1; empty groups retained
physical axes. The adapter corrects only nonempty DOWN minima. Wide/tall headings,
nested/empty groups, cross-boundary edges and both directions pass. Requalify the
correction for engine upgrades/custom workers from another version. The related
[upstream report](https://github.com/kieler/elkjs/issues/313) is supporting context;
local tests establish behavior for the actual pinned engine. No phantom content or
post-layout stretching is introduced.

Native C4/DDD group options use the same geometry to position the heading/drag area
and retain content/control slots. Collapsed headings remain compact. The native
frame positions children independently of its static decorative border; a browser
check caught an unnecessary two-unit correction, which was removed. SSR and real
DOM geometry now agree. Artwork must fit its declared rectangle; separate controls
need space in padding or a custom controls slot. Default renderers stay compact
without the option. Empty groups and headings wider than children reserve minimum
width as well as the top band.

## Workbench and local acceptance

The default workbench heading remains unchanged. Expanded architecture heading
uses one 640 by 112 declaration, with 24-unit padding and gap, for both layout and
custom native DDD/C4 rendering. Selection changes presentation without arranging;
Arrange remains explicit. Changing the heading cancels old layout and measurements.
The new option composes with measured edge labels, theme and Minimal mode. Restore
recovers original geometry; the user can return the heading selector to Default.
The expanded preference alone cannot reserve space in original geometry.

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/group-headers-browser.mjs
```

The full suite packs and installs core/ELK into a fresh npm consumer, checking
runtime, strict Bundler/NodeNext types and native renderer options. Tests cover
unknown/non-group/duplicate hints, detachment, invalid dimensions/padding/gap,
overflow, minimum sizes, child exclusion, stale results, Undo, preview history,
custom content and collapse. Workbench tests execute the real ELK Command, preserve
source/projection/working history and ignore completion after heading changes.

Browser acceptance reads actual DOM rectangles and camera transform. It verifies
640 by 112 world units at a 24-unit top/left inset and at least a 24-unit child gap,
for RIGHT and DOWN and with measured edge envelopes. Geometry remains correct
through native wheel zoom. Keyboard Arrange retains focus; nine findings and the
exact exported working model/lineage survive closing the review. No application
Model/DOM content is injected; no external requests or page errors are accepted.
Assertions allow 0.1 world unit for browser matrix rounding, not whole-pixel overlap.
This is fixture evidence, not a universal collision guarantee.

Artifacts: [browser receipt](group-headers-browser.json),
[light / RIGHT](group-headers-light.png), [dark / DOWN](group-headers-dark.png) and
[zoomed heading detail](group-headers-detail.png). All captures use the local
production build and native controls.
