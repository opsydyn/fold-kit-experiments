# Edition archive import and restore — 2026-11-08

- **result:** complete
- **claim:** package-owned additive archive merge and explicit graph restoration preserve the working model until confirmation; accepted restore creates one Undo step with fresh policy/revision checks.
- **evidence:** behavioral and packed-consumer tests, workspace typecheck/check/tests, production demo/API builds, and the [Chromium transcript](edition-restore-browser.json) with inspected light/dark/protection screenshots.
- **remaining uncertainty:** local qualification only; no deployment, npm publication, automatic persistence, fork/merge, playback or comprehensive assistive-technology/cross-browser acceptance. The separately requested CI/action audit follows this slice.
- **next:** resolve the reported CI failures and audit action versions/runtimes before any release; edition forks with explicit lineage remain a subsequent feature slice.

Recommendation: **needs follow-up** for CI qualification before release.
Architecture, delivery and test review were self-review, not independent review.
See [ADR 0019](../../../docs/adr/0019-import-edition-archives-and-restore-undoably.md)
and the [public contract](../../../packages/foldkit-zloz/README.md#import-and-restore-editions).

## Package boundary

`mergeEditions` validates incoming checkpoints, appends new identities, skips exact
matches and rejects a complete batch on identity conflicts or duplicate input.
Existing editions and the working editor are never overwritten. The existing
archive decoder and version-1 graph/edition formats are unchanged.

`resolveEditionRestore` previews a graph-only replacement; `restoreEdition`
revalidates the required expected revision, read-only/gesture/Undo state and
current policy before using the existing graph transaction. Camera and edition
artifacts stay unchanged. Commit increments freshness, invalidates routes and
adds one graph Undo entry. Exact graph no-ops retain the original editor.

Whole-transaction and existing granular policies protect deletion, movement,
reparenting, resize, architecture, appearance, retained-node ports, connection
creation and reconnection. Port kind replacement is remove/add. Fields without
specific hooks belong to the whole-transaction policy. Blank denials stay denials.
Connection policy sees the complete candidate graph without the candidate edge;
unchanged reconnect endpoints are not new port connections. This is an owned-Model
correctness boundary rather than security against a host rewriting its own state.

Astro composes the public operations. Its Command checks one file up to 5 MiB,
strict UTF-8 and canonical decoding. Request-specific interruption and collection
identity checks reject cancelled, superseded and stale reads. Generated capture
IDs skip imported collisions. The UI supplies preview/cancel, a live protection
reason, explicit confirmation and a current camera guarantee. Ignored historical
editor events now return the unchanged Model without misleading edit notices.

## Verification

Baseline workspace typecheck/check passed before edits. The first focused test
failed on absent restore exports. Core tests cover additive/idempotent/conflicting
merge; one-step Undo/Redo; camera and immutable edition preservation; stale, busy,
read-only, no-op and unavailable-Undo cases; policy rechecks and the relevant
editing-policy families, including port kind replacement and endpoint semantics.

Workbench tests cover strict decoding, byte limits, cancellation of only the
addressed request, cancelled/stale completions, collection conflicts, capture-ID
collisions, explicit preview/cancel, policy changes and stale confirmation. The
final workspace suite passes. The clean npm consumer executes the public merge,
preview and Undo behavior under Node/Bun and verifies required revision options
through both TypeScript resolution modes. Core remains dependency-free.

Final `bun typecheck`, `bun run check`, `bun run test`, production workbench and
TypeDoc builds pass locally. Existing warnings/hints are not presented as zero.
The production-browser pass imports an actual exported archive after reload,
checks idempotence and whole-batch conflict rejection, rejects invalid UTF-8 and
oversized input, cancels a preview, demonstrates a live veto, restores, verifies
camera preservation, uses two Undo steps to prove earlier history survives, uses
Redo, and verifies unchanged edition exports. No page errors were recorded.

The browser pass qualifies the visible restore/cancel workflow; async import
cancellation is qualified by the Command and reducer tests. Accessibility evidence
is limited to native controls, roles, reasons and exercised keyboard behavior.
No CI, deployment, publication or universal accessibility claim follows from these
local results.

## Visual evidence

- [Light restore preview](edition-restore-light.png)
- [Dark restore preview](edition-restore-dark.png)
- [Protected confirmation](edition-restore-protected.png)
