# V2 comparison presentation qualification

- result: complete
- claim: validated v2 comparison presentation exposes explicit mode meaning and composable FoldKit status/ghosts while retaining layer preferences through minimal mode.
- evidence: 21 focused tests, installed Node/Bun/strict TypeScript consumers, visibility mutation, inspected static light/dark Chromium fixture and passing repository checks below.
- remaining uncertainty: mounted workbench/CLI adoption, v2 change navigation/append/restore/playback, device/human accessibility and wider C/Q/R qualification remain open; C1 is partial.
- next: v2 change navigation with an explicit mode-change entry and side-preserving focus before restore/playback adoption.

Measured parent: `cc045909`, isolated `codex/zloz-context-map` worktree.
See [ADR 0099](../../../docs/adr/0099-present-v2-comparisons-with-mode-feedback-and-ghosts.md).
Architecture, delivery and test-quality reviews are self-review.

## Delivered boundary

Core `resolveHistoryComparisonPresentationV2` validates explicit checkpoints using
the v2 comparator and returns frozen pins, language-ready mode/graph summary text,
layer preferences and effective visibility. It never owns or mutates an editor,
mode, selection, Undo, policy, playback or restore operation. Minimal mode masks
master visibility while retaining choices. Mode-only changes have explicit text
and no synthetic graph marks. Camera/metadata stay excluded from graph flags.

Optional FoldKit `zlozHistoryComparisonPresentationV2` provides an unstyled polite
live status with replaceable/omittable summary, mode and layout. Hosts own accessible
meaning when replacing content. `zlozHistoryGhostsV2` shares the established
canonical drawing with v1 through an internal graph-only helper. Visibility comes
from context; typed customization exposes only inert mark renderers. Defaults
remain aria-hidden, pointer-inert and nonfocusable. Arbitrary custom SVG must obey
the same inertness contract; types cannot inspect host-generated markup.

## Regression and development evidence

Six public SSR/DOM tests cover explicit changed and unchanged modes, mode-only
empty deltas, independent layout/meaning summaries, real loose-only input→input
edges, old geometry/edge/movement marks, hidden/global/individual layers, retained
minimal preferences, formatter fallbacks, replacement/omission/layout/mark hooks,
text escaping, camera exclusion and frozen projections. Existing v1 ghost and v2
comparison tests pass with the shared renderer: **21 focused tests**, no failures.

The first run failed at the missing public export. A temporary mutation bypassing
minimal-mode masking caused its visibility regression to fail; restoring the
source returned all focused tests to green. No mutated source remains. The real
packed consumer imports root and FoldKit APIs/types, renders custom status content,
checks mode-only feedback and retained minimal-mode preferences under Node/Bun,
and rejects drawing-level visibility overrides with strict TypeScript.

The initial browser attempt was blocked by macOS sandbox process registration;
the authorized local Chromium run succeeded. The first fixture assertion counted
all status regions, including two existing canvas statuses; it was scoped to the
comparison component's accessible name. Lint flagged pure editor initialization
as resource acquisition; a targeted annotation records that it returns immutable
data with no external resource. These development failures are not passes.

## Static visual evidence

[HTML fixture](history-presentation-v2.html) and
[light/dark screenshot](history-presentation-v2.png) compose the public resolver,
status, read-only editor, themes and `renderWorldOverlay` ghost wrapper. The top
mode-only comparison has no graph changes; the light panel shows previous geometry
and movement while the dark minimal panel hides ghosts and retains mode feedback.
Chromium assertions checked comparison statuses, mode text, ghost/movement counts
and dark visibility. The screenshot was visually inspected.

Reproduce locally (requires installed Playwright Chromium):

```sh
bun packages/foldkit-zloz/evidence/history-presentation-v2-browser.mjs
bunx oxfmt packages/foldkit-zloz/evidence/history-presentation-v2.html
```

This is a static package-rendered fixture, not mounted workbench adoption or
interaction evidence. No new device, human screen-reader, hosted or current CI
qualification is claimed. Custom renderers and host-language accessibility remain
host responsibilities.

## Repository verification

Full workspace tests passed with exit 0: core **779 pass**, workbench **169 pass**,
CLI **31 pass**, no workspace failures. Two existing promo skips remain separate.
Full `bun typecheck` and `bun run check` completed with exit 0. Existing
Effect/TypeScript lint hints and the Viz skill-version warning remain distinct
from errors. The baseline Astro run also emitted a nonfatal sandbox WebSocket
listen diagnostic while still completing with exit 0.
`bun run --filter @opsydyn/foldkit-zloz docs` completed with exit 0, generating
resolver/context/options and FoldKit view/parts/ghost type pages with warnings
treated as errors.

No npm publishing, deployment, dependency or version changes. C1 and wider C/Q/R
gates remain partial; v2 navigation, append, restore/playback and adapter adoption
are separate work. Recommendation: **needs follow-up** for v2 change navigation
with explicit mode entry and side-preserving focus before restore/playback.
