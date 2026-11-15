# Mounted v2 history/workflow qualification

result: complete for the approved local mounted workflow.

claim: the sidebar workbench composes package-owned v2 history workflows without losing checkpoint modes or independent working history.

evidence: production Chromium receipt passed with zero page errors, inspected light/dark/minimal screenshots, validated downloads and nine new app/file tests.

remaining uncertainty: human assistive technology, other browsers/devices, current CI and hosted qualification remain open.

next: reconcile the remaining portable-adapter v2 compatibility boundaries.

Measured parent: `a5d90525`, isolated `codex/zloz-context-map` worktree.
See [ADR 0102](../../../docs/adr/0102-complete-v2-history-workflows.md) and
[package qualification](../../../packages/foldkit-zloz/evidence/history-workflow-v2.md).
Reviews are self-review. Scope is the new `/history/` workspace; existing strict
architecture and connection workspaces remain independent.

## Mounted workflow

The production build is served locally on `http://127.0.0.1:4377/history/`.
Four model-controlled sidebar sections keep the canvas visible. Mode/status
feedback, theme, minimal mode and minimap/ghost preferences remain independent.
Native canvas help retains its accessible description in a sidebar disclosure.

The [Chromium receipt](history-workflow-v2-browser.json) records a mounted run,
not static SSR-only rendering. The script waits for Astro hydration and exercises:

- Review an actual loose input→input checkpoint from strict working state; inspect
  mode without moving camera; switch baseline/selected with correctly placed ghosts
  and chronological edge meaning.
- Light/dark switching and minimal mode hiding ghosts while retaining checked
  preferences, chosen mode and independent working editor.
- Protected restore preview, no confirm while blocked, fresh preview after policy
  change, cross-mode confirmation and one working Undo/Redo.
- Capture current working graph/mode; download validated canonical v2 model and
  archive; verify actual input→input port kinds and explicit mode in downloaded data.
- Reopen identical archive idempotently, reject conflicting identity without
  replacement, reject invalid UTF-8 and open the downloaded model with fresh Undo.
- Return to the retained previous working session with its own Undo/mode.
- Real automatic mixed-mode playback, pause, rewind and manual stepping while
  reduced motion disables automatic play. No page errors are tolerated.

The final script also asserts string ARIA pressed/hidden tokens for active sections
and decorative SVG. These checks do not substitute for human assistive technology
or a complete accessibility audit.

## Visual evidence

- [Light](history-workflow-v2-light.png)
- [Dark](history-workflow-v2-dark.png)
- [Minimal](history-workflow-v2-minimal.png)
- [Downloaded model](history-workflow-v2-model.json)
- [Downloaded editions](history-workflow-v2-editions.json)

Screenshots were visually inspected at 1440×1000. JSON artifacts are formatted for
review after download; values are unchanged. The canonical current snapshot,
checkpoint modes and loose-only edge remain intact. No editing history, timer or
review state is serialized.

## State and file qualification

Nine new workbench/file tests cover current-side navigation, theme/minimal retention,
protection round-trip invalidation, one-step restore/Undo/Redo, scoped callbacks,
atomic/idempotent/conflicting imports, cancelled/stale/failed results, fresh model
initialization, return to previous working history, stale clocks, visibility and
reduced-motion pause, measurement/idle cleanup and mode inspection without camera
changes. File Commands reject size before reading, recheck bytes, decode fatal UTF-8
and reject old/invalid envelopes. Downloads use scoped object-URL cleanup.

Play is opt-in. Hidden-page and reduced-motion changes invalidate clocks; inspection
and section changes pause them. Passive measurements and idle gesture cleanup do
not. Restore confirmations bind captured edition and working revision, recheck live
protection/busy state and publish editor/mode together. Import cancellation ignores
obsolete completions; matching stale revisions clear only their pending read.

The first mounted playback run exposed an idle `GestureCancelled` from canvas
cleanup. A visible-state probe identified it; regression tests protect that cleanup
and passive measurement. An initial harness world-transform selector was corrected.
No temporary diagnostic state or mutated source remains.

## Reproduction and limits

```sh
bun run --filter @opsydyn/zloz-demo build
python3 -m http.server 4377 --bind 127.0.0.1 --directory apps/zloz-demo/dist
# In another shell, with installed Playwright Chromium:
bun apps/zloz-demo/evidence/history-workflow-v2-browser.mjs
bunx oxfmt apps/zloz-demo/evidence/history-workflow-v2*.json
```

`ZLOZ_HISTORY_URL` can select another local production server. The browser receipt
is written only after all assertions pass. Final repository check results are
recorded in the package qualification.

No npm publishing or deployment occurred. This is local Chromium desktop evidence;
no real-device, human keyboard/screen-reader acceptance, Firefox/WebKit, current CI
or hosted parity claim is made. Mermaid/patch/receipt/packet/CLI v2 adoption remains
separate and the UI makes its supported model/archive format boundary explicit.
