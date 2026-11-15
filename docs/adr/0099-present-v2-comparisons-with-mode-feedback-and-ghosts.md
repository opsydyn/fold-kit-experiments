# ADR 0099: Present v2 comparisons with mode feedback and ghosts

## Status

Accepted for the approved package-level presentation slice, 2026-11-15. Follows
[ADR 0098](0098-compare-v2-editions-with-explicit-mode-changes.md).
Architecture, delivery and test-quality reviews are self-review.

## Decision

Add `resolveHistoryComparisonPresentationV2(baseline, selected, options)` in core.
It calls the v2 comparator once to validate/detach both explicit checkpoints in
their own modes. Return a frozen context with the comparison, mode/summary text,
frozen ghost preferences and separately derived effective visibility. The host
owns checkpoint selection and saved preferences. No editor/session is stored or
changed. No restore, conversion, policy evaluation or Undo entry is produced.

Mode feedback explicitly describes unchanged mode or the before/after transition.
Graph summary uses graph deltas rather than aggregate semantic change: a mode-only
transition says no node/edge changes alongside its mode message. Camera and edition
metadata retain the existing exclusion from graph comparison. Text formatters
support host language, with blank output falling back to defaults. Default text
has no numeric diagnostics. Names render as text, never markup.

Ghost layers default visible when hosts explicitly compose the presentation.
Reuse the existing comparison controls' visibility value type; callers can pass
saved preferences without new control state or request protocols. Minimal mode
masks only effective master visibility, retaining all choices and mode meaning.
Individual node/edge/movement layers remain independent.

Add optional `zlozHistoryComparisonPresentationV2` and `zlozHistoryGhostsV2` to
the FoldKit entry. The first is an unstyled polite live status with replaceable
summary/mode parts and layout. Undefined uses defaults; null omits a part. Hosts
that replace or omit content own its accessible meaning. The overlay consumes
effective visibility from the resolved context; its customization options expose
only inert node/edge/movement render hooks, preventing typed drawing options from
overriding visibility. Extract the existing graph-only ghost drawing into an
internal helper reused by both versions. Do not pass v2 through a v1 comparator,
create fake mode nodes, rewrite ports or duplicate geometry logic.

Default ghosts remain visual-only, aria-hidden, pointer-inert and outside the
focus sequence. Compose them under the world transform in `renderWorldOverlay`.
Custom SVG renderers must remain inert; the type system cannot inspect arbitrary
host-generated SVG for focus or event handlers. Mode meaning lives in the status
view or a host equivalent, never solely in decorative marks.

## Alternatives and boundary review

Boundary verdict: **safe with noted risk**. Core depends only on v2 comparison
and the existing headless visibility value type; only the FoldKit entry imports
HTML builders and the shared graph renderer. No DOM, delivery or provider concern
enters the resolver. The host still owns the live editor and application layout.
Simplicity check: reuse comparison validation, visibility and geometry rather than
adding a parallel settings reducer or new drawing engine. A version-erasing v1
presentation path would omit mode meaning. Coupling this slice to restore/playback
would mix read-only presentation with cross-mode editing authority.

The context is a typed derived projection, not a decoder for forged arbitrary
contexts. Create it through the resolver. No new wire format, dependencies,
version bump, npm publication or deployment. Workbench/CLI adoption, v2 change
navigation, append, restore/playback and wider C/Q/R qualification remain open;
C1 stays partial.

## Evidence and next

[Qualification](../../packages/foldkit-zloz/evidence/history-presentation-v2.md)
records public tests, real installed consumers, visibility mutation, static
light/dark Chromium rendering and repository checks. Static fixture evidence does
not claim mounted workbench interaction, device or human accessibility acceptance.

Next: v2 change navigation with an explicit mode-change entry and side-preserving
focus before cross-mode restore/playback adoption.
