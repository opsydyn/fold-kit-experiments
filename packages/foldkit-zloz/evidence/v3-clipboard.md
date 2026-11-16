# Native v3 clipboard qualification

- result: complete
- claim: Native v3 session copy/paste preserves group/socket identity relationships and publishes a fully validated live-policy target as one Undo unit.
- evidence: Headless/controller/view/app regressions, installed consumers and source-hashed production browser captures with raw canonical model downloads; results below.
- remaining uncertainty: No OS clipboard, hosted/registry, broad performance or human physical-device/screen-reader acceptance.
- next: Native v3 Mermaid projection/export with explicit group-port findings and exact-output loss review.

[ADR 0112](../../../docs/adr/0112-paste-native-v3-fragments-with-explicit-identities.md)
records the scope and alternatives. Architecture, boundary, delivery and test-quality
reviews are self-review. Core owns bounded data, mappings and live transaction
planning; the native workbench Model owns transient clipboard and selection. The
optional Foldkit controls emit source-bound facts and remain replaceable through
headless APIs. No transport, permission, dependency or canonical-format change.
Boundary verdict: **safe with noted risk**. The native runtime model adds transient
clipboard fields; matching mode/capability and opaque metadata limits stay explicit.

## Observed behavior

- Whole-source copy captures selected groups and descendants once. Internal edges
  and group sockets survive; external parents/constraints detach and crossing
  edges omit with explicit findings. Read-only copying and a live copy veto are
  independent from editing permission.
- Exact complete node/edge/scoped-port maps reject collisions, omissions, aliases
  and extra entries. Same-named ports on different owners remain distinct. Rooted
  world geometry and bends translate once; opaque metadata stays unchanged.
- Plan/Apply recheck full source session/revision/document, lifecycle, mode and
  capability, geometry, Undo settings and current port/connection/whole-document
  protections. A cached plan grants no permission. Failure preserves editor/history;
  paste creates one full-document Undo, and Undo/Redo rerun directional policy.
- Immutable plans own caller data. Accessor inputs do not execute; explicit null
  maps reject rather than silently selecting defaults. Unexpected policy exceptions
  propagate. Session clipboard is not persisted or rewound by history.
- Composable controls keep denial and omission reasons in minimal mode. Keyboard
  and button events share package publication. Repeated workbench offsets avoid
  occupied anchors; exact custom requests remain available.

## Verification

Local Bun 1.4.4 / Node 24.15.0 qualification on 2026-11-16:

- Targeted native data/controller/view tests exercise independent expected
  positions/endpoints, nested membership, metadata, real live vetoes and Undo.
  Initial missing native entry tests failed before implementation. SSR controls
  assert real enabled/disabled controls and minimal-mode findings.
- `bun typecheck`: all workspaces exit 0. `bun run test`: all workspaces exit 0,
  including **930 core unit tests** and **199 workbench tests**. Installed Node/Bun
  peer-free core/browser imports, strict Bundler/NodeNext type contracts, native
  copy/paste policy/Undo and optional Foldkit clipboard SSR all pass. Existing
  conditional skips remain; no tests were disabled.
- `bun run check`: root lint/format/catalog/skills pass, with repository warnings
  kept separate (including the existing Viz skill version warning). The browser
  JSON receipt is formatted after capture.
- Production demo build: exit 0, four static routes. API docs: exit 0 with
  warnings treated as errors.
- Chromium 151.0.7922.34, 1440×1000, reduced motion: five UI interaction groups
  pass with zero page errors. Actual canonical downloads show 3→6→9 nodes and
  2→4→6 connections. Group owner/port maps, child membership and one translation
  are asserted directly from downloaded authored documents; two keyboard Undos
  restore the original graph and Redo restores the first complete paste.
- Current interface protection disables paste and retains a visible reason in
  dark/minimal mode. Keyboard copying a boundary alone retains both omitted-edge
  reasons while optional instructions hide. Read-only edition copying stays
  independent and paste stays disabled; returning retains the working clipboard.
- Browser script owns/closes its loopback server and Chromium. Source hashes bind
  all **165 relevant core/app files**; four download hashes bind exact unmodified canonical
  bytes, archived as `.txt` to preserve wire formatting in this repository.

[Browser receipt](../../../apps/zloz-demo/evidence/v3-clipboard/browser.json) ·
[Light pasted groups](../../../apps/zloz-demo/evidence/v3-clipboard/light-pasted.png) ·
[Dark protected paste](../../../apps/zloz-demo/evidence/v3-clipboard/dark-protected.png) ·
[Minimal findings](../../../apps/zloz-demo/evidence/v3-clipboard/minimal-findings.png) ·
[Before](../../../apps/zloz-demo/evidence/v3-clipboard/before.txt) ·
[Pasted](../../../apps/zloz-demo/evidence/v3-clipboard/pasted.txt) ·
[Repeated](../../../apps/zloz-demo/evidence/v3-clipboard/repeated.txt) ·
[Undone](../../../apps/zloz-demo/evidence/v3-clipboard/undone.txt).
Captures were visually inspected. The adjacent `v3-clipboard-browser.mjs` reproduces
the checks. Harness refinements unwrap canonical download envelopes, refocus native
handles between rerenders and preserve exact download bytes; no controller checks
were relaxed.

This is session clipboard, not an external clipboard decoder or OS integration.
Matching mode/capability is required; opaque metadata references are not rewritten.
Paste-into-parent, cut, full envelope collision avoidance, broad performance,
physical-device and human screen-reader acceptance remain separate. No fresh
empty-cache CI rehearsal, remote CI, publishing or deployment was performed.

Recommendation: **needs review** before PR/merge. Next is native v3 Mermaid with
explicit representation/loss review, not silent downgrade of authored sockets.
