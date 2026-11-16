# Native v3 SVG export qualification

- result: complete
- claim: Native v3 SVG planning/writing/review preserves full source contracts and authored group ports without editing history.
- evidence: Native/legacy regression tests, installed consumers and source-hashed workbench/download evidence; measured checks below.
- remaining uncertainty: Static artwork only; no native PNG, hosted deployment/publication, broad performance or human device/AT acceptance.
- next: Native v3 PNG through this same validated SVG projection and fidelity reporting.

[ADR 0110](../../../docs/adr/0110-export-native-v3-groups-as-reviewed-svg.md)
records scope, alternatives and implementation. Architecture, boundary, delivery
and test-quality reviews are self-review.

Core owns complete document validation, source identity, fidelity review and safe
projection. Host adapters declare custom fidelity and supply safe vector
primitives; the host Model owns review scope/revision, current policy and Command
execution. No legacy editor is forged; no group-port downgrade or document/Undo
mutation is performed. Native SVG is static graphics, not an editable model file.

Coverage includes nested ported groups and paint order; strict/loose mode and
camera crops; immutable adapter source, bounded/anchored owned routes, full-source
and renderer-key staleness; invalid/unsupported resources and safe output budgets;
exact-source/settings/bytes loss consent, live policy, cancellation/supersession
of download settlement, and read-only edition scopes. Existing SVG/font/PNG
contracts are regression-tested without enabling native PNG.

## Observed verification

Local verification on 2026-11-16, Bun 1.4.4 / Node 24.15.0:

- `bun run check`: exit 0, including Oxlint/Oxfmt/catalog/skill checks. Existing
  repository warnings (including the Viz skill version warning) remain separate.
- `bun typecheck`: all workspaces exit 0 after correcting new fixture literal
  return types. The app's focused test-project typecheck also passed after final
  demo-only badge/label refinements.
- `bun run test`: all workspace tests exit 0. Core **911 tests** and workbench
  **196 tests** passed. Installed tarballs exercised native SVG plans/writing,
  anchored layout, review/download payloads and native review SSR; Node/Bun
  peer-free core and strict Bundler/NodeNext contracts passed without workspace
  links. Existing conditional skips remain; no tests were disabled.
- Native and existing SVG planner/writer/review regressions: **35 passed**.
  Final app layout/SVG/history tests: **6 passed** after the visual refinements.
- Production demo build: exit 0, four static routes. API docs: exit 0 with
  warnings treated as errors, including native v3 public contract links.
- Headless Chromium **151.0.7922.34**, 1440×1000, reduced motion: **4 interaction
  groups passed, zero page errors**. The script downloads both palettes and
  parses the actual SVG: XML valid, v3/mode/capability metadata present, connected
  group edge starts at its authored socket, no script/foreignObject elements.
  It verifies exact-artifact consent reset, current policy/minimal-mode reasons,
  unchanged model bounds and independent one-step layout Undo after download.
- Visual review caught an oversized custom badge overlapping a child. The final
  demo uses compact positioned badges with scoped theme contrast and explicit
  label envelopes for ELK. These are demo compositions of existing primitives.
  Captures of light/dark/minimal UI and the downloaded vector were inspected.
- **162 source SHA-256 hashes** and both downloaded SVG hashes independently
  match the browser receipt and final working source/files.

[Browser receipt](../../../apps/zloz-demo/evidence/v3-svg/browser.json) ·
[Light review](../../../apps/zloz-demo/evidence/v3-svg/light-review.png) ·
[Dark fidelity review](../../../apps/zloz-demo/evidence/v3-svg/dark-fidelity-review.png) ·
[Minimal protection](../../../apps/zloz-demo/evidence/v3-svg/minimal-protected.png) ·
[Downloaded SVG raster capture](../../../apps/zloz-demo/evidence/v3-svg/exported-dark.png) ·
[Light SVG](../../../apps/zloz-demo/evidence/v3-svg/native-light.svg) ·
[Dark SVG](../../../apps/zloz-demo/evidence/v3-svg/native-dark.svg).
The adjacent `v3-svg-browser.mjs` script reproduces the UI/download evidence.
The raster capture is browser evidence of an SVG file, **not a native PNG API**.

No remote CI, fresh empty-cache CI rehearsal, hosted deployment or npm publishing
was run for this local slice. Local tarballs and browser emulation are not registry,
provider, human physical-device or screen-reader acceptance evidence. Font shaping,
custom content/ink bounds and broad performance remain unqualified.

Recommendation: **needs review** before PR/merge. Proceed next with native v3 PNG
using the same validated projection and consent/fidelity contract.
