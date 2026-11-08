# Named editions, read-only rewind and ghosts — 2026-11-08

- **result:** complete
- **claim:** core owns portable immutable editions, read-only review and model/layout comparison; the optional Foldkit entry supplies composable inert ghosts, demonstrated through the History workbench section.
- **evidence:** literal archive and behavioral tests, packed Node/Bun/TypeScript consumers, workspace verification, production build, generated API documentation and the [Chromium transcript](history-browser.json) with inspected screenshots.
- **remaining uncertainty:** local qualification only; archive import UI, automatic persistence, restore/fork/merge, playback, collaborative history, large-history benchmarking and comprehensive assistive-technology/cross-browser acceptance remain separate.
- **next:** archive import and explicit restore as a fresh undoable transaction, preserving the working model until the user chooses the transition.

Recommendation: **needs follow-up** for the next history slice. This implementation
is locally qualified and ready for review. Architecture, delivery and test review
were self-review; no independent agent review is claimed.

## Delivered contract

The pure core exports `captureEdition`, `appendEdition`, `serializeEditions`,
`parseEditions`, `createHistoryReview`, `updateHistoryReview`,
`isHistoryNavigationEvent`, `compareEditions` and their public types. Edition IDs
and names are host-owned; snapshots are detached and deeply frozen. A separate
`foldkit-zloz-editions` version-1 archive retains captured graph/camera snapshots.
The existing graph/snapshot version 1 and editor freshness token are unchanged.

The change contract uses distinct added/removed/changed payloads so added entries
require their new element. Comparison distinguishes meaning from authored layout
and core paths; camera-only and array paint-order changes do not produce graph
change entries. Custom renderer output and external routing are not replayed.

Historical review owns its own camera, selection and measurement. A fail-closed
navigation allowlist blocks edits, measurements of nodes and Undo/Redo. The host
keeps the working editor, rejects mutation actions and stale async results during
review, and returns without changing its graph, camera, clipboard, revision or
Undo stack. Current surface measurement is carried across edition switches and
refreshed on return after a resize. Optional selection policies compose through
the review update adapter. This is correctness within an owned application Model,
not a security boundary against a host rewriting JavaScript state.

`zlozHistoryGhosts` and `ZlozHistoryGhostOptions` live in the optional Foldkit
adapter. Ghost outlines, baseline edges and movement connectors are inert SVG,
not graph nodes/ports/hit targets. Movement endpoints reuse canonical geometry;
overlapping cards use an outside lane. Global/node/edge/movement switches and
inert mark callbacks compose independently. The workbench supplies a textual
change list, persistent read-only notice, minimal-mode masking, theme controls,
named capture, baseline selection and archive export. Example editions append
without overwriting earlier captures.

Editions remain session-owned until exported. Core parsing supports reopening
archives by consumers; there is no claim of automatic persistence or a shipped
archive-import interface. See [ADR 0018](../../../docs/adr/0018-add-portable-editions-and-read-only-history.md)
and the [public guide](../../../packages/foldkit-zloz/README.md#named-editions-and-read-only-history).

## Evidence and verification limits

Baseline `bun typecheck` and `bun run check` passed before implementation.
The initial core test failed on the absent `captureEdition` export. Final focused
history/ghost tests pass **8 tests / 49 assertions**; final workbench tests pass
**18 tests / 122 assertions**. They cover literal decoding, malformed versions/
records/cameras/duplicate identities, immutable snapshots, blocked mutations and
node measurements, independent camera navigation, unchanged working Undo, meaning
versus layout, edge geometry, noninteractive ghosts, individual/global switches,
small overlapping movement and measurement continuity across edition changes.

`bun typecheck`, `bun run test` and `bun run check` passed during qualification.
After the final discriminated public-type refinement and resize integration fix,
affected core/workbench typechecks and tests, the full workspace test suite,
production demo and API documentation were requalified as appropriate. The
installed-consumer test verifies both runtime behavior and rejection of an invalid
added-change payload through TypeScript, using public imports under Node/Bun and
both module-resolution modes. Pure core installation adds no Foldkit/Effect/
layout dependency. TypeDoc generates the history functions/types and ghost API.

The browser script uses the production static build. It captures a working
checkpoint, loads two Order editions, inspects an evolved model, verifies blocked
Delete/movement and disabled ports, compares a baseline, toggles each ghost layer,
uses Minimal mode, changes themes, navigates the historical camera, returns to the
unchanged graph/camera, verifies existing Undo, and downloads/reopens the archive.
At 390 × 844 the controls collapse, Fit shows the complete model, and the
persistent return control remains available. This is an overview at that scale;
zoom/pan provide detail inspection.

Initial browser-script refinements corrected an immediate read before a toggle
render settled and used the Fit rail button's accessible name, **Fit view**.
The final [transcript](history-browser.json) records no page errors. Screenshots
were fitted and visually inspected; they are not an accessibility certification
or evidence of large-model performance. No deployment or npm publication ran.

## Visual evidence

- [Light comparison](history-light.png)
- [Dark comparison](history-dark.png)
- [Narrow-screen history](history-mobile.png)
