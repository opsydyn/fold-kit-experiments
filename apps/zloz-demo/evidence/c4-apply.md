# C4 workbench Apply qualification

- result: complete
- claim: the workbench publishes a guarded C4 editor transaction and frozen source/target record together; one Undo restores the source while retaining the record.
- evidence: production browser keyboard/light-dark captures, exported source/target comparisons, host message tests and repository checks recorded below.
- remaining uncertainty: tab-local records are not persisted or portable; human acceptance and hosted qualification remain untested.
- next: qualify strict portable C4 conversion receipts before download/reopening.

See [ADR 0089](../../../docs/adr/0089-publish-c4-apply-and-provenance-in-workbench.md).
This host composes the core Apply API; it does not create its own conversion graph,
containment resolver or portable receipt format. The editor and record are assigned
in one synchronous Model transition with no command or intervening async action.

## Automated evidence

The initial new host tests failed at the missing Apply message constructor. Seven
new host cases now cover atomic publication/no commands, detached frozen source and
target provenance, one Undo/Redo with record retention, revoked/missing consent,
foreign/hidden/stale/replayed callbacks, current read-only/busy/history protection,
source camera round trips, protection round trips, example changes, Minimal-mode
rendering without raw keys, and final affected relationship policy rejection.
Together with existing review tests, the full app suite passes **158 tests**.

Initial TypeScript checks found a closure that lost placement-union narrowing and
a test assertion that did not narrow a nullable reason; both were corrected with
typed narrowing. Oxlint rejected direct null returns in a policy helper; it now uses
the established Option resolver and converts at the package policy boundary. An
app typecheck run overlapping a package build saw transient missing dist modules;
rerunning after the build completed passed. These are development failures, not
passing evidence. Full `bun typecheck` and `bun run check` completed locally with exit 0. Existing
configured warnings/skips remain; no warning-free qualification is claimed. Full
`bun run test` completed with exit 0, including **158 workbench tests** and the
real installed-package consumers. Production build and browser qualification also
completed with exit 0 and no page errors.

A temporary mutation bypassed Apply's review-generation check. The stale-generation
and replayed-callback test failed. Restoring the original source returned all **17
C4 review tests** to green; no mutated source remains.

## Production browser evidence

`bun run --filter @opsydyn/zloz-demo build` and
`node apps/zloz-demo/evidence/c4-apply-browser.mjs` ran locally. The script serves
that production artifact on a loopback ephemeral port; Playwright observes actual
browser messages, downloads and rendering rather than calling app internals.
[Result JSON](c4-apply-result.json) records the bounded assertions and zero page errors.

- Explicitly maps three workshop nodes and both communications; reviews organization
  placements and every loss before Apply. No runtime containment is inferred.
- Space acknowledges; Enter applies. Opt-in protection visibly disables Apply and
  withdraws consent. Unlocking requires a fresh acknowledgement.
- Checks exported target model identity, editions, ancestry, world positions, ports
  and retained memberships; named communications have no reserved workshop descriptor.
- One Undo restores the complete exported source graph; Redo restores the complete
  target. The visible conversion record remains through Undo and Minimal mode.
- Captures current light/dark readiness and retained meaning with the canvas visible:
  [ready light](c4-apply-ready-light.png), [ready dark](c4-apply-ready-dark.png),
  [retained light](c4-apply-retained-light.png), [retained dark](c4-apply-retained-dark.png).
  The light readiness and dark retained images were visually inspected for legibility
  and sidebar/canvas visibility.

The earlier [plan-review receipt](c4-plan.md) remains historical evidence. Its browser
script now expects a guarded disabled Apply action in the current product; this slice
adds a separate production evidence script and captures for actual Apply.

## Scope and remaining gates

Records are frozen in-memory data, separate from DDD receipts. Reload loses records;
there is no C4 download, decoder or reopening. Full source/camera/session/revision,
editions/ancestry and choices are retained in the record; the sidebar shows a human
summary of source and target meaning plus placement. Core relies on the host's current
source identity and synchronous pure policies. Raw exact-content keys remain callback
data and are never rendered in DOM. No new core API, wire version, npm publishing,
deployment, complete D1b/C/Q/R closure or independent review is claimed. Architecture,
boundary, delivery and test-quality reviews are self-review.

Recommendation: **needs follow-up** for strict portable receipt qualification.
