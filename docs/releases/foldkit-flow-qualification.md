# FoldKit Flow 0.1.0 local qualification — 2026-11-03

**Result:** The two local release candidates are implemented and locally qualified
in `fold-kit-experiments` on `main`, based on `ba968f0`. Work remains uncommitted;
no npm publication, push, deployment or credential changes were performed.
The pre-existing untracked `.claude/` directory was left alone.

**Claim:** `@opsydyn/foldkit-flow` supplies a dependency-free editor core and an
optional native FoldKit view. `@opsydyn/foldkit-flow-elk` supplies replaceable
automatic layout with fixed ports and orthogonal routes. The `/flow` example
demonstrates custom text inputs, selection, movement, connection, undo, arrange,
save and reload. Scope is the flat-graph 0.1 API described in the package READMEs,
not React Flow feature parity.

**Evidence:** Local macOS, Node `24.15.0`, Bun `1.4.4`, FoldKit `0.170.0`,
Effect/platform-browser `4.1.0`, elkjs `0.12.1`.

| Check                                           | Observed result                                                                                                                                                           | Receipt                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `bun run check`                                 | Passed; existing unrelated warnings remain; no Flow diagnostics                                                                                                           | [Log](evidence/foldkit-flow-0.1.0-local/check.txt)           |
| `bun typecheck`                                 | Passed across the workspace                                                                                                                                               | [Log](evidence/foldkit-flow-0.1.0-local/typecheck.txt)       |
| `bun run test`                                  | 1,977 passed, zero failures; one existing promo Pages artifact check skipped                                                                                              | [Log](evidence/foldkit-flow-0.1.0-local/workspace-tests.txt) |
| Both `pack:check` scripts                       | Publint and Are The Types Wrong passed under the ESM-only profile                                                                                                         | [Log](evidence/foldkit-flow-0.1.0-local/pack.txt)            |
| Packed npm consumer, included in the full suite | Core alone installed without FoldKit, Effect, ELK or React; Node/Bun core imports; Bundler/NodeNext TypeScript; Node SSR and real ELK layout passed outside the workspace | [Test](../../packages/foldkit-flow/test/package.test.ts)     |
| `/flow` Playwright journey                      | Two Chromium cases passed: 1365×900 and 390×844; no page errors                                                                                                           | [Log](evidence/foldkit-flow-0.1.0-local/browser.txt)         |
| Production web build                            | Passed; Vite reports large chunks                                                                                                                                         | [Log](evidence/foldkit-flow-0.1.0-local/web-build.txt)       |
| Workflow syntax and whitespace                  | Both modified YAML workflows parsed; `git diff --check` passed                                                                                                            | Local command output                                         |

The 15 Flow package tests include 200 property cases for undo/redo/serialization
and cursor-anchored zoom, invalid documents/layouts, stale and superseded layout
results, measurements, pointer identity, cancellation, read-only edits, native
input teardown and real ELK output. The clean npm consumer is one of those tests.
The browser journey also verifies keyboard port connections, text-editing key
isolation, drag cancellation, save/reload and malformed-storage preservation.

Screenshot inspection found that replacing the document lost the measured surface
size. The load handler now preserves that browser fact; an awaited browser bounds
assertion verifies Fit after reload. Input rebinding also clears unfinished
gestures, with a focused red/green lifecycle regression. Both checks pass.

Agent-inspected captures: [desktop](evidence/foldkit-flow-0.1.0-local/desktop.png)
and [mobile viewport](evidence/foldkit-flow-0.1.0-local/mobile.png).
These are engineering evidence, not human visual approval or a physical-device test.

Final checked tarballs are in each package's `dist/pack/`. SHA-256:

```text
7f75466aa31c46a6665b9eb0680a16762140f64a95a31ec8c35d0a0e259cd9ac  opsydyn-foldkit-flow-0.1.0.tgz
59f461fe2c6341becfa6e83f4ead354bc4b6b1776f5540756ebd37a5e61b2d96  opsydyn-foldkit-flow-elk-0.1.0.tgz
```

**Remaining uncertainty:** Hosted CI, its Node 22 run, npm provenance and a
registry-installed consumer have not run. Physical touch, assistive technology,
DevTools time-travel interaction, browser worker packaging and large graphs need
separate qualification. The default ELK fallback installs `self.onmessage` in
Bun 1.4.4 and keeps a standalone process alive; Node is the supported CLI layout
path for this candidate. The isolated probes created for that diagnosis were
stopped; the Playwright-owned server exited normally. No shared server was used.

**Next:** Review the `/flow` interaction and public API, then prepare the first
release through the [publication guide](foldkit-flow.md). Publication should use
the reviewed ref and checked archives, core first, followed by registry/provenance
and consumer verification. Dagre, nested groups and a custom solver remain later
decisions driven by actual consumer needs.
