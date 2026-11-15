# ADR 0073: Declare group-header layout envelopes

## Status

Accepted for the approved explicit group-heading bounds slice, 2026-11-13.
Architecture, boundary, delivery and test-quality reviews are **self-review**.

## Decision

Add optional `groupHeaders` to `LayoutRequestOptions` and `LayoutRequest`.
`LayoutGroupHeader` identifies an existing group and declares a positive finite
header size, nonnegative finite top/right/bottom/left padding and a nonnegative
finite gap before children. IDs are unique. `layoutRequest` detaches nested size
and padding records. Omitting hints preserves the legacy request shape.

`resolveLayoutGroupHeader` is shared pure geometry: it validates the declaration,
returns the world header rectangle, minimum group size and content padding.
Header position is group position plus left/top padding. The child area begins at
padding.top + header.height + gap. Minimum width includes header width plus both
horizontal paddings; minimum height includes the header, gap and vertical padding.
Overflowed arithmetic fails. These are typed contracts, not unknown-input decoders.

Core validates requested group minima and every direct child's containment in the
reserved child area before publishing any result. Nested group rectangles are
children too. Missing/incorrect reservations fail atomically. Stale request/revision
results retain existing ignore semantics; normal layout remains one Undo and
read-only preview layout preserves past/future. No hints enter graph persistence,
source descriptors, history or SVG/PNG wire formats. There is no new EditorState
cache: the host passes the same immutable heading configuration to layout and view,
and invalidates pending layout when that configuration changes.

ELK maps the declaration to parent padding and MINIMUM_SIZE constraints, growing
empty groups and headings wider than their children. Tests on pinned elkjs 0.12.1
reproduced compound minima being transposed under DOWN, while empty leaf groups
retain physical dimensions. The adapter normalizes the minimum vector only for
nonempty DOWN groups. Real-engine wide/tall, nested/empty and cross-boundary-edge
cases qualify this correction; requalify/remove it when upgrading ELK or supplying
a different engine version. Related upstream report:
[elkjs #313](https://github.com/kieler/elkjs/issues/313). Options follow
[padding](https://eclipse.dev/elk/reference/options/org-eclipse-elk-padding.html),
[minimum size](https://eclipse.dev/elk/reference/options/org-eclipse-elk-nodeSize-minimum.html)
and [size constraints](https://eclipse.dev/elk/reference/options/org-eclipse-elk-nodeSize-constraints.html).
No post-layout stretching, phantom nodes or source-ID changes are used.

C4/DDD group renderer options accept `groupHeader`. They validate it with the same
helper and position the existing drag/header area at its exact declared bounds.
Existing inert content slots and interactive controls remain composable. Collapsed
groups keep compact headings; no hints means existing heading geometry. The native
positioning frame is borderless, separate from its static decoration, so heading
coordinates require no border adjustment. Browser geometry checks guard this.
Reserve room for separately positioned controls through padding or custom controls.

## Host demo and alternatives

The workbench keeps Default heading as its initial choice. Expanded architecture
heading shares one declaration (640 by 112, padding 24, gap 24) between a custom
DDD/C4 body and the layout request. Native selection changes presentation only;
Arrange is explicit. A change cancels old layout/label measurements. Source,
projection, findings and working graph/Undo are preserved. Header declarations
compose with existing declared or measured edge envelopes, themes and Minimal mode.
Restore recovers original geometry; a chosen expanded style stays selected, so its
space guarantee resumes after another Arrange or users can return to Default.

Automatic DOM header measurement would add a separate lifecycle/freshness contract;
it is not part of this explicit sizing slice. Persisting visual heading dimensions
inside semantic nodes would mix rendering with source architecture. Post-layout
resizing would risk sibling overlap. The chosen request metadata plus shared pure
helper reuses layout validation and renderer slots without new dependencies.

## Scope, evidence and rollback

The guarantee covers group bounds and direct child rectangles after accepted
layout, not arbitrary edge paths, overflowing custom artwork or separate controls.
Renderers must match declared bounds and hosts must cancel/supersede work on heading
changes. Other engines may satisfy the geometry; unsupported results are rejected.
No provider, SDK, npm, push or deployment action is included. Revert the local commit
to roll back this additive contract.

Test invalid/duplicate/non-group hints, detachment, overflow, minimum dimensions,
child exclusion, stale rejection and Undo/read-only boundaries. Test native C4/DDD
custom content, compact collapse and actual installed tarballs. Run the ELK matrix,
workbench source/cancellation tests, browser rectangle/gap checks in both directions
and with measured edges; inspect light/dark/native-zoom captures. Run root typecheck,
check, all tests and production build before commit.
