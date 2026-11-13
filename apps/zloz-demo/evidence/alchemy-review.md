# Read-only Domain descriptor workbench qualification

- **result:** complete
- **claim:** the approved workbench slice reviews portable Alchemy descriptors
  through bounded host text decoding, with source provenance and visible loss
  findings. A detached read-only editor preserves the working model and Undo.
- **evidence:** root typecheck/check/workspace tests, 118 workbench tests, production
  Astro build and local Chromium acceptance. Retained light/dark screenshots were
  inspected. Boundary, architecture, implementation and test-quality reviews are
  **self-review**. No SDK inspection, provider, release or deployment was performed.
- **remaining uncertainty:** provenance/state/version fields remain host claims;
  published core 0.3.0 is unqualified, and both upstream strict-optional failures
  remain explicit. Other browsers/devices, manual screen-reader acceptance, hosted
  operation and full Domain semantics remain unobserved. Fixed preview positions
  are not a semantic layout or incremental layout guarantee. Cancellation discards
  late bounded reads; it does not promise to interrupt native Blob IO.
- **next:** package-level source-fact navigation linking findings to their node or
  relation in the detached canvas. Recommendation: **needs review**.

## Host boundary and preservation

The private adapter's portable root owns descriptor validation and projection.
The workbench owns raw-text framing and resource limits: 1 MiB of UTF-8, depth 16,
16,384 JSON values. Grammar preflight rejects decoded duplicate keys, invalid
numbers/escapes, non-finite numbers and multiple documents before native JSON value
construction. Descriptor versions/extra fields/identity/topology remain adapter
checks. File IO is a Command, bounded to a 1 MiB + 1 byte slice with fatal UTF-8
decoding. Paste has both character and UTF-8 byte bounds. No input is evaluated.

Draft/pending/review are separate model fields. Invalid input retains the previous
preview; changing text, cancellation, newer reads and model/epoch changes invalidate
late results. Conflicting edits, reads, placement, history playback/review and PNG
rendering prevent opening. Detached input passes through core's navigation-only
history reducer. Editing and other working actions are unavailable during review.
Closing restores the unchanged editor/editions/model lineage/saved models and
mapping receipts/consent; review never adds Undo, stores a model or grants Apply.

Source package version, namespace, model and revision are visible as declared
provenance. All nine fixture findings remain visible even in Minimal mode: one
unverified behaviour finding, one stream-role loss and seven untyped relationship
losses. Coverage is 23 source facts: eight declarations, seven parent memberships
and eight visible relations. Stateful view and accepted feed have native DDD roles.
The graph is rendered as seven nodes plus one bounded-context group. There is no
Apply action. The initial preview fits on first measurement; explicit Fit and the
collapsed rail Fit operate on the detached editor only.

## Observed checks

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/alchemy-review-browser.mjs
```

All exited 0. Existing repository advisory warnings and existing skipped tests
remain; this is not a zero-warning or full-browser-coverage claim. Workbench tests
exercise exact 1 MiB acceptance, multibyte over-limit input, malformed/framed JSON,
escaped duplicate keys, depth/value limits, invalid versions/forged fields,
provenance/loss counts, read-only navigation and edit rejection, bounded/invalid
UTF-8 files, stale/cancelled/latest reads, busy guards, previous-preview retention
and working-state preservation.

During implementation, TypeScript caught the textarea API shape and an overly
narrow test helper type. Workbench tests exposed a new module cycle, resolved by
moving initialization into `alchemy-state.ts` with type-only dependencies. Browser
assertions initially counted the context group as an ordinary node and assumed the
rail's visible Fit text was its accessible name; selectors were corrected. Visual
inspection then found clipping after fitting with controls collapsed; the preview
now exposes Fit directly and initially fits on measurement (a targeted regression
test verifies changed viewport and unchanged Undo). Unsupported group-collapse
chrome is omitted through the renderer composition API. No upstream gate was
suppressed to obtain a pass.

## Browser evidence

Chromium exercises keyboard example opening, native read-model rendering, all
findings/provenance, disabled editing navigation and Delete rejection, collapsed
rail Fit, explicit Fit, light/dark/Minimal-mode presentation, oversized paste restoring the previous bounded draft, escaped duplicate-key
rejection and recovery, invalid UTF-8 retention, valid file revision replacement,
and exact canonical working-model/lineage equality after closing. No page errors
or external network requests were observed. The browser uses synthetic portable
data and makes no SDK/provider compatibility claim.

[Structured browser receipt](alchemy-review-browser.json) ·
[Reproducible script](alchemy-review-browser.mjs) ·
[Light provenance capture](alchemy-review-light.png) ·
[Dark findings capture](alchemy-review-dark.png).

The sidebar scrolls independently of the canvas. Captures were inspected for
shared neutral/blue light and dark themes, readable provenance/findings, an explicit
read-only banner, return/Fit controls and visible native architecture artwork.
Manual assistive-technology acceptance and mobile layout remain separate evidence.

See [ADR 0068](../../../docs/adr/0068-review-alchemy-descriptors-through-a-bounded-host-boundary.md)
and [private adapter contract](../../../packages/foldkit-zloz-alchemy/README.md).
