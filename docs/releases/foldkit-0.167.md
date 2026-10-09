# FoldKit 0.167 release notes

## Compatibility

Both published packages now target FoldKit `>=0.167.0 <0.168.0` and stable
Effect `4.0.0`. Upgrade FoldKit alongside these packages: the previous
0.165/0.166 peer range is no longer supported by this release. Astro remains
7.1.1 in the qualification environment. Viz's pure geometry entry points still
work without installing either optional peer.

Astro uses `@foldkit/vite-plugin` 0.27.x and FoldKit's generated build identity
for coordinated client/server builds. Explicit deployment IDs remain supported.
The public `lazyApp`, `defineApp`, `definePage` and `resolvePageDocument`
contracts are unchanged. See the [migration guide](../migrations/foldkit-0.167.md)
for subscription renames, lifted lifecycle readers and SSR deployment guidance.

## Examples

- The new comparison workbench composes up to four keyed histogram/scatter
  panels. Reorder preserves child state, removed IDs ignore late messages,
  and linked ranges highlight every matching datum while preserving local
  inspection. It is available at `/comparison`, in `Charts/Comparison`, and
  at the promo's `/examples/comparison/`.
- Comparison source, copy, ZIP and external StackBlitz use maintained app
  sources. Exports snapshot panel IDs, kinds, order, linking and the next ID,
  not transient measurements or inspection. Vendoring checks canonical paths
  and rejects traversal and escaping symlinks.
- The existing shared KeyedQuery dataset explorer and its standalone starter
  are aligned with FoldKit 0.167. Stale-result rejection remains distinct from
  the request-diagnostics example's explicit route-exit interruption.
- Chart fixes cover range boundaries, responsive brush preservation, current
  pointer bounds, reverse keyboard entry and visible native focus outlines.

These are application examples, not new public chart-controller APIs. Astro
retains lifecycle/rendering ownership and Viz retains pure chart primitives.

## Qualification boundary

The source review and automated checks do not imply complete browser acceptance.
Desktop/390px visual rechecks, complete pointer/focus journeys, real export
delivery and assistive-technology/device checks remain tracked in the
[comparison qualification record](../superpowers/specs/2026-10-08-keyed-chart-comparison-qualification.md).
Storybook's large-chunk advisory and TypeDoc's missing-reference warnings are
tracked separately from lint/typecheck failures.

The repository releases via a reviewed feature PR, then release-please's
version/changelog PR. GitHub release creation, npm publication and app/docs
deployment are separate outcomes and must each be verified.

### Integrated local checks (2026-10-09)

- Frozen-lockfile install, lint/format and all five workspace typechecks passed.
- 564 tests passed: Astro 77, Viz 168, promo 78 and web 241. The Pages-only
  test is skipped in the default suite and passed separately against a
  base-path production build (229 assertions).
- Both production apps, Storybook and TypeDoc built. Storybook retains its
  large-chunk advisory; TypeDoc retains 11 missing-reference warnings.
- Regression checks caught and fixed comparison links/download paths under
  the Pages prefix and the dataset starter's mismatched dependency pins.
  Comparison filesystem tests now use the OS temporary directory rather than
  macOS-only paths, so they can run on the Linux CI host.

These are local automated results, not hosted publication or browser acceptance.
