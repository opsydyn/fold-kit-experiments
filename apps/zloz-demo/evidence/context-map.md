# Composable context maps — local qualification, 2026-11-11

Implementation lives in the fresh `codex/zloz-context-map` worktree based on the
committed DDD contract `45604f4`. Other workstreams and the previous worktree were
not edited. See [ADR 0039](../../../docs/adr/0039-compose-context-map-presentation.md).

- **result:** complete
- **claim:** package-owned context-map projection, connectors, side badges and starter are demonstrated in the workbench with an independent presentation toggle.
- **evidence:** host-captured root check/typecheck/test, installed Node/Bun consumers, API docs, production build and Chromium checks all exited 0; light/dark images were inspected.
- **remaining uncertainty:** local evidence only; no hosted, comprehensive accessibility or performance claim, frame projection, publication or deployment.
- **next:** needs review; then add composable DDD relationship and side-role editing controls with protection reasons and Undo.

## Scope and ownership

Core exports the pure relationship projection and detached four-card starter.
The optional Foldkit entry exports connectors, participant badges and label
composition. Shared geometry, hit targets, selection, reconnection, policy and
native label editing remain with the existing canvas. The app consumes public
APIs and demonstrates custom source badges, both themes and a separate presentation
preference. Minimal mode does not remove authored semantic badges.

All four strategic patterns are shown. Symmetric links omit arrows; directional
links show upstream/supplier → downstream/customer. Unknown custom patterns have
no assumed direction. Authored meaning and restriction reasons remain readable
without implying a certified domain model or technical message flow. Portless
frames remain outside the drawable-edge contract.

The label hook now permits semantic content on unlabeled/unselected/read-only
edges; undefined preserves previous default visibility and null omits content.
Native actions respect read-only/selection restrictions and describe full side
roles. Custom/nullable parts, badges, attributes and layout retain explicit seams;
interactive forms use the existing label-editor hook. No rendering step writes a
label, creates Undo or changes source/target.

## Evidence

- Test-first pure API run failed for absent exports, then the starter/projection
  and one-Undo insertion tests passed.
- SSR tests exercise directed/symmetric paths sharing the native hit path,
  missing labels, fallback/null behavior, protected/read-only actions and custom
  layout/parts. The SSR fixture was corrected to use the existing builder-first
  canvas signature; behavior assertions were retained.
- Workbench tests cover public starter consumption, composed DDD policy, untouched
  graph/editor on presentation changes, diagnostic independence and atomic insertion.
- Packed consumer fixtures qualify root and optional view exports, declarations
  under Bundler/NodeNext and execution under Node/Bun. No Foldkit/Effect dependency
  is added to the headless root.
- Browser fixture corrections use the native editor's actual accessible field name
  and wait for the captured edition to enter the catalogue before seeking it.
  No freshness or protection guard was relaxed.

## Browser evidence

```sh
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/context-map-browser.mjs
```

Chromium **151.0.7922.34**, viewport 1600×1200, reduced motion. Checks passed for
all four patterns, canonical hit selection, correct markers, full side-role names,
keyboard label editing plus Undo, presentation toggle preserving snapshot/camera,
Minimal mode, read-only edition review and return to the unchanged working graph.
Canonical model downloads were inspected; no page errors.

[Light screenshot](context-map-light.png) · [Dark screenshot](context-map-dark.png).
Both were visually inspected: all four context cards and relationship labels fit
inside the persistent canvas, with shared neutral/blue family themes. Source:
[browser script](context-map-browser.mjs).

This is local Chromium evidence, not hosted, screen-reader or comprehensive a11y
acceptance. No frame projection, new persistence format, DDD relationship inspector,
performance superiority, publishing or deployment is claimed. Architecture,
delivery and test-quality reviews are self-review. Existing causal browser fixture
selectors were updated for the now-composed policy label; their historical images
were retained.

## Final verification

- `bun run check` — exit 0, including lint, formatting, catalog and skill checks. Existing repository warnings remain; zero warnings is not claimed.
- `bun typecheck` — all workspaces, exit 0.
- `bun run test` — all workspace suites, exit 0, including actual installed package fixtures; existing skips remain.
- `bun run --filter @opsydyn/foldkit-zloz docs` — exit 0, with public root/view context-map contracts included.
- `bun run --filter @opsydyn/zloz-demo build` — exit 0.
- `node apps/zloz-demo/evidence/context-map-browser.mjs` — exit 0, browser checks listed above, no page errors.

Focused tests include three headless projection/starter cases, three SSR view
cases and two new workbench cases. The complete workbench suite passes 64 tests.
Installed consumer checks cover the new root factory/projection and optional view
exports/types alongside the existing public composition fixtures. TypeDoc contains
both `Core.resolveContextMapRelationship` and `FoldKit.zlozContextMapLabel`.

Recommendation: **needs review**. This is local implementation and package/browser
qualification, not independent review or a released/deployed artifact.
