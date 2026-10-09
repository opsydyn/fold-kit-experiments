# Keyed chart comparison workbench

Status: spec, five-task plan and subagent-driven execution approved on 2026-10-08.
Tasks 1-3 are implemented and reviewed. Task 4 source/automated checkpoint
`70b7c7b` is approved, with live browser acceptance pending. Task 5 export
implementation and automated qualification are complete; controller review and
remaining browser acceptance are pending. Standalone smoke was observed, with a
scatter-axis label overlap deferred to the final correction wave.
See the qualification document and authoritative controller `progress.md` ledger.

## Outcome and scope

Developers can compare views of the same illustrative dataset, add and rearrange
charts without losing panel state, and download a working example to adapt.
This demonstrates FoldKit 0.167's `foldChildAt` through a useful workflow rather
than introducing another public chart orchestration API.

The first useful task is to inspect a salary range in a histogram, see every
matching point in a scatter chart, then reorder the panels without resetting
their models. Data is explicitly illustrative, not a salary benchmark.

Approved scope:

- Start with one scatter and one histogram panel; allow zero to four panels.
- Add either type, remove panels, and move them earlier or later with accessible
  arrow controls. No drag-and-drop dependency.
- Use one immutable local dataset with unique stable datum IDs.
- Support independent inspection or parent-coordinated linked highlighting.
- Repair the existing first-matching-point limitation without breaking ordinary
  scatter callers or changing public Viz package APIs.
- Deliver an Astro reference page and a runnable promo/download example.

The selected scatter/histogram approach reuses existing linked components.
Time-series comparison was considered but deferred because synchronised cursors
and time-range policies would broaden the work beyond keyed child ownership.

## Current evidence and prerequisite

The FoldKit 0.167 compatibility upgrade was separately authorised and committed
as `3fe48cf`. Feature work is isolated in the managed `keyed-chart-comparison`
worktree. Upgrade and feature checkpoints remain separately reviewable; none
has been pushed, merged or published by this implementation.

Relevant code at the design baseline (the limitations below are now repaired
by the reviewed Tasks 1-3):

- `apps/web/src/apps/linked-charts/`: fixed sibling composition and typed
  OutMessage handling.
- `apps/web/src/ui/scatter-chart/index.ts`: one `activeIndex` currently controls
  highlighting and the tooltip; OutMessage keys currently come from labels.
- `apps/web/src/ui/histogram-chart/index.ts`: emits inspected numeric intervals.
- `apps/web/src/apps/linked-charts/fold.ts`: uses `findIndex` to highlight only
  the first point within an inspected interval.
- `apps/promo/src/lib/example-project.ts`: packages maintained example sources
  and compiled Viz dependencies into standalone projects.

The installed FoldKit 0.167 declarations confirm that `foldChildAt` uses keyed
`readAt`, `writeAt`, and `toParentMessage` callbacks. A missing child produces
`{ model }`; the keyed OutMessage handler runs only for a present child.

## State and ownership

The parent Model owns an ordered readonly array of panels and a monotonic
`nextPanelId`. Each panel contains its ID and a tagged `Scatter` or `Histogram`
model. The array is the only ordering source; do not maintain a duplicate order
list or parallel child-state registry for four panels.

Panel IDs are allocated deterministically by the parent, never from array
positions, labels, time, or random values. IDs are never reused during an app
instance, including after the collection becomes empty. A fresh application
instance may initialise its own counter.

Each panel owns its chart model and local inspection. The parent owns the
linking mode and, when linked, an optional semantic inspection with its source
panel ID. Represent linking as a tagged union: `Independent` or
`Linked({ inspection: Option<LinkedInspection> })`. A linked inspection is a
point identified by datum ID or a numeric range with explicit endpoint policy.

Do not store duplicate matched-key lists in every child. Derive matching datum
IDs and per-panel highlights from the parent inspection and shared data. A
panel's local active point or bin remains separate from this derived overlay.
Transient pointer coordinates and measured bounds are not semantic selection.

## Keyed update contract

Use one `foldChildAt` adapter per chart type. Parent Messages carry the panel ID
and the corresponding typed child Message. Readers return `Option.none()` when
the ID is absent or belongs to the wrong chart type. Writers replace only the
existing matching panel; they never insert a missing one.

`toParentMessage` captures the stable ID for child Commands and subsequent
messages. Initialise new children through FoldKit init folding so their Commands
are retained rather than extracting only the model.

Typed child OutMessages report inspection facts. The parent consumes them once
and updates its linked inspection when linking is enabled. Derived sibling
highlights do not dispatch more inspection Messages, preventing feedback loops.
No Port or event bus is necessary inside this one parent application.

Collection transitions are total:

- Adding at four panels is a no-op; both add controls are disabled.
- Removing an unknown ID or moving beyond either endpoint is a no-op.
- Reordering preserves the actual child models and ID-keyed rendered elements.
- Removing the linked source clears only the linked inspection; removing any
  other panel leaves it unchanged.
- Late child Messages for removed IDs or mismatched types produce no child
  update, no Commands, and no OutMessages. They cannot recreate a panel.
- Empty collections retain the add controls and a concise empty-state label.

## Linked inspection semantics

Linking starts enabled with no active linked inspection. Switching it off drops
only the shared inspection; local child state is unchanged. Switching it on
starts without a source, avoiding an arbitrary choice among existing local
inspections. The next inspection fact establishes the source.

Point inspection resolves exactly one datum by its stable ID. Duplicate labels
or equal coordinates do not make two points the same datum. Scatter siblings
highlight that datum; histogram siblings highlight the bin containing it.

Range inspection selects every datum whose salary belongs to `[lower, upper)`.
Only the final histogram bin includes its upper endpoint. Carry this endpoint
policy in the semantic inspection rather than infer it from rounded labels.
Histogram siblings highlight bins containing at least one selected datum, not
merely bins whose numeric bounds overlap an empty range.

A cleared-inspection fact removes shared highlighting only when it comes from
the current source. A delayed pointer-leave from a different panel must not
erase a newer source's inspection. Empty matches produce an empty set and a
visible zero count, never a fallback point.

The range overlay uses the same result for mark styling and the matching-point
count. Distinguish it from a local active point using an outline or another
non-colour cue. Keep the single local active point for keyboard navigation and
its tooltip; linking must not move focus or replace that point.

Reordering itself does not reset inspection. Ordinary inspection events, such
as pointer leave, retain their documented behaviour; preserving state does not
mean suppressing subsequent user input.

## Repairing the existing limitation

Extend the app-owned scatter rendering contract with an optional keyed
highlight overlay, separate from its existing active-point behaviour. New
workbench data must supply unique IDs. Do not require all existing scatter
callers to add IDs or change their default single-point interaction.

The workbench adapter must emit stable datum IDs, not the existing label-based
OutMessage key. Give the existing linked-chart fixture stable IDs as well and
update its histogram-to-scatter path to show every match. Preserve the existing
scatter-to-histogram interaction and non-linked scatter behaviour.

Use existing Viz selection/geometry helpers where suitable. This is selection
and rendering work, not a new binning or scale algorithm. Any necessary chart
math change still requires checking the repository's D3 reference source.

## View, accessibility, and measurement

The primary screen is the workbench itself, with a compact toolbar and repeated
chart panels. Use a two-column layout when space allows and one column on small
screens. Keep chart headings, axes, units, counts, and controls readable without
horizontal page overflow. No marketing hero or explanatory overlay is needed.

Use clearly labelled add commands, a native checkbox/switch for linking, and
icon buttons with accessible names and tooltips for move/remove actions. Panel
names include a stable ordinal so duplicate chart types are distinguishable.
Disable impossible moves. DOM reading order follows the array order.

Both chart types support keyboard inspection with a visible focus indicator.
Histogram keyboard navigation must produce the same interval facts as pointer
inspection. Provide a data table or equivalent existing data alternative, and
expose matching-point counts as text. Avoid an unbounded tab stop per datum.

After adding a panel, focus its heading or first chart control. After removal,
focus the next surviving panel's heading, otherwise the previous one, otherwise
the add control. Reordering retains focus on the moved panel's control. Where
explicit focus is needed, use a FoldKit Command and supported post-render DOM
helpers; do not put DOM references in the Model or mutate DOM from a view.

Stable DOM keys do not refresh cached screen coordinates. Measurement must
remain valid after add/remove/reorder, scrolling, and resizing. Reuse or adapt
the existing scoped measurement pattern, report measurements as Messages, and
verify actual pointer hit testing after movement. Clean up observers/listeners
when panels or the host are removed. Honour reduced motion.

## Hosting and downloadable project

Keep a single maintained workbench implementation in application-owned source,
with its parent modules under `apps/web/src/apps/comparison/`. Reuse the existing
app-owned scatter/histogram components. A dedicated `/comparison` page hosts it
through the established Astro integration; no integration API changes.

The promo `/examples/comparison/` page uses a thin host/export wrapper around
that same implementation. Do not maintain a second copy of the update or
matching logic. Its build-time source collector must include the workbench and
the transitive local chart helpers needed by the standalone project.

Extend the existing export workflow narrowly for this example. The generated
project must contain all referenced sources/assets and only resolvable internal
paths: no `workspace:` dependencies, cross-app imports, or repository aliases
left dangling. Keep source inspection and the existing ZIP/StackBlitz delivery
mechanism; an additional live-code editor is out of scope.

Capture panel types, IDs, order, and linking mode in exported initial settings.
Transient measurements, pointer positions, active hover/tooltips, and host
export status are not persisted. The exported ID counter must start above every
captured panel ID. Use the qualified FoldKit/plugin versions and existing
vendored Viz dependency strategy; do not require an unpublished registry release.

## Acceptance gates

- [x] Default state has one scatter and one histogram with unique IDs.
- [x] Add/remove/reorder obey the four-panel cap, preserve child state, and
      never reuse IDs, including remove-all followed by add.
- [x] Keyed folds preserve child Commands and consume OutMessages once.
- [x] Removed-ID and wrong-type Messages are complete no-ops.
- [x] Matching tests cover all points in a range, zero matches, duplicate
      labels, equal coordinates with distinct IDs, and both interval endpoints.
- [x] Render tests prove every matching scatter mark is highlighted while one
      independent keyboard-active point and tooltip remain intact.
- [x] Existing linked charts show all matches; ordinary scatter callers retain
      their original behaviour without supplying new options.
- [x] Linking toggles preserve local state; source removal and source-specific
      clear events behave as specified without sibling feedback loops.
- [x] Pointer and keyboard histogram inspection produce equivalent ranges in
      automated tests; real browser input remains part of the following gate.
- [ ] Browser checks at 390px and desktop widths cover add/remove/reorder,
      focus recovery, visible matching counts, and hit testing after movement,
      resize, and scroll. Observe teardown and no duplicate host runtime.
- [x] The promo example and downloaded project use the same maintained code.
      Downloaded settings reflect current structure; install, typecheck, and
      build succeed outside the monorepo. Only the data-only `initial-settings.ts`
      is replaced; the maintained `settings.ts` validation is retained.
- [x] Focused downloaded-project browser smoke confirms the captured structure,
      add/reorder, multi-match inspection and linking toggle. Controller also
      observed 390px control fit; scatter y-axis label overlap remains to fix.
- [x] `bun run check`, `bun typecheck`, and `bun run test` pass; build both apps
      and Storybook. Use the root test script to target workspaces rather than
      bare `bun test`, which also discovers vendored reference tests.

Local tests, browser smoke, accessibility review, and publication are separate
evidence. Do not mark these gates complete based on this spec or the earlier
dependency migration's results.

## Exclusions and next stage

No remote data, Query/KeyedQuery cache, persistence, time-series synchronisation,
VirtualList, Machine runtime, new public Viz/Astro API, chart-math rewrite, or
unrelated package cleanup belongs in this slice. The upgrade checkpoint had
separate authority; feature approval does not authorise push, merge or release.

The approved implementation plan has separately reviewable steps for the
range-highlight repair, keyed composition, interaction/measurement qualification
and promo export. Next gates are controller review and live browser acceptance.
The Mac is unlocked. Controller-observed standalone results are recorded in the
qualification document; reference/promo checks and the scatter label-overlap
correction remain open. Further UI checks are pending exclusive browser access
after unrelated navigation invalidated the controller's Firefox binding.
