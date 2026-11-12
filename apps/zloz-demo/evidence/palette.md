# Native/custom placement palettes — local qualification, 2026-11-12

Source base: `b40971e`, isolated branch `codex/zloz-context-map`; implementation
is in the commit containing this receipt. Extends
[ADR 0051](../../../docs/adr/0051-plan-and-apply-headless-placement.md) and the
[headless receipt](../../../packages/foldkit-zloz/evidence/placement.md).

- **result:** complete
- **claim:** package-owned native/custom palette controls support mouse/touch and
  keyboard placement, transient preview, live protection, cancellation and atomic
  Apply/Undo. The workbench composes the public APIs for C4 and DDD cards.
- **evidence:** host-captured root check/typecheck/tests, workbench production build
  and TypeDoc exited 0. Core: 447 passing tests; workbench: 104. Packed Node/Bun
  consumers execute the new core exports. Chromium 151.0.7922.34 checks passed at
  1600×1100 with zero page errors, with the five visual captures below.
- **remaining uncertainty:** touch is Chromium emulation, not a physical-device
  result. Manual assistive-technology, broader browser/device and large-graph
  performance qualification remain unobserved. Existing warnings/skips remain.
  No publishing/deployment occurred; Alchemy stays deferred.
- **next:** needs review; then define the bounded E3 SVG export contract with
  bounds, themes and custom-renderer fidelity reporting before PNG.

## Package contract and ownership

Core exports `resolvePlacementControls`, `updatePlacementControls`,
`placementForScope`, palette entry/policy, input and context types. Optional
`/foldkit` exports `zlozPlacementHost`, `zlozPalette`, `zlozPaletteEntry`,
`zlozPlacementAction`, `zlozPlacementPreview` and the scoped `bindPlacementInput`.
One stable host contains one canvas/palette; nested hosts keep their input isolated.
The Live Mount owns native listener/capture lifecycle, with authoritative pending
placement and editor state retained in Model.

Palette entry activation is protected separately from position-dependent Apply
policies. Preview and Apply use the accepted headless kernel. Old source/scope and
Apply target callbacks reject; a keyboard nudge cannot silently rebase a stale
projection. Users can nudge away from a policy-rejected destination without
weakening Apply checks. Intent grid overrides determine keyboard step; client-space
headless targets retain their measured origin when continuing with keyboard input.

Pointer samples remeasure canvas origin at each move/release. Mouse/touch drag or
card activation followed by a canvas tap share one path. Inside release applies
once; outside release retains pending state without insertion. Pointer cancel,
lost capture, window blur and Escape discard pending placement without Undo.
Keyboard uses arrows, Shift acceleration, Alt bypass and Enter; explicit Apply and
Cancel buttons remain available. Unrelated sidebar controls and editable fields
retain native keys. The host normalizes further CSS transforms and file/MIME IO.

Custom cards use the same semantic button helper and a package-owned touch frame.
Replacing button styles therefore cannot remove the frame's touch behavior. The
browser run reproduced and caught native touch cancellation before that fix.
The default decorative preview draws node-frame ghosts; semantic/edge artwork can
be supplied through the existing world overlay and full public preview context.
Diagnostics suppress instructions and coordinates independently; protection
reasons and actions stay available in minimal mode. Canonical v1 formats are unchanged.

## Verification

```sh
bun test packages/foldkit-zloz/test/placement.test.ts packages/foldkit-zloz/test/placement-controls.test.ts packages/foldkit-zloz/test/placement-controls-view.test.ts packages/foldkit-zloz/test/placement-input.test.ts
bun typecheck
bun run test
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/palette-browser.mjs
bun run --filter @opsydyn/foldkit-zloz docs
bun run check
```

Focused placement/controller/render/native-boundary tests: 21 passing tests and
179 assertions, including the 12 pre-existing headless placement regressions.
New tests cover scoped callbacks, activation/late policy veto, destination recovery,
exact coordinate expectations, intent snapping, one Undo, listener/capture cleanup,
other pointer IDs, cancellation/blur, editable fields, nested hosts, native/custom
semantics and minimal diagnostics. The first interaction regression failed before
its public API existed; a separate policy-recovery regression failed before its fix.

Workbench tests verify simultaneous editor/session publication, live protection,
Undo and model-epoch isolation. The actual packed tarball consumer compiles positive
and negative contracts under Bundler/NodeNext with exact optional properties,
then runs headless and palette preview/Apply under Node and Bun without UI peers.
TypeDoc generates the new public functions and contracts.

The browser script exercises keyboard, mouse drag, Chromium touch drag, cancellation,
late protection, one Undo and native/custom/light/dark/minimal presentation. Mouse
and touch nodes land at the release position within two CSS pixels (border/render
rounding). It verifies graph node counts and absence of page errors. Screenshots
were inspected locally; these are browser captures, not design mockups:

- [Native keyboard preview](palette-native.png)
- [Custom light preview](palette-custom-light.png)
- [Custom dark preview](palette-custom-dark.png)
- [Minimal mode](palette-minimal.png)
- [Live protection](palette-protected.png)

Command logs are retained locally under `/private/tmp/zloz-palette-*`; install and
browser checks used authorized cache/loopback access. No dependency was added.
Architecture/boundary, delivery and test-quality reviews are self-review. Verdict:
**safe with noted risk** for host-supplied measurements and unqualified large-graph
preview cost. Before release, rollback is a local commit revert with no data migration.
