# ADR 0068: Review Alchemy descriptors through a bounded host boundary

## Status

Accepted for the user-approved read-only workbench slice, 2026-11-13.
Boundary, architecture and test-quality reviews are self-review.

## Context and decision

ADR 0067 split trusted SDK inspection from portable validated projection. The
workbench needs to review portable descriptors without loading user code or
replacing its working model. Add a workspace dependency on the private adapter,
importing only its portable root. Keep SDK inspection and all provider execution
outside the browser path. No external dependency upgrades or release changes.

The app owns a fixed host JSON-text boundary: 1 MiB of UTF-8, maximum value depth
16 and 16,384 values. Preflight grammar, decoded duplicate keys, finite numbers
and single-document framing before native JSON construction; then let the adapter
own strict descriptor/version/identity/topology validation and projection.
File reads use a bounded slice, check length, decode UTF-8 fatally and publish a
message through a Command. Paste and file input use the same text decoder.

Keep draft, pending read and last valid detached review in the Foldkit model.
Run/model/epoch identities reject late or cancelled reads. Changing the draft
invalidates pending reads but does not silently replace an existing preview.
Rejected input retains previous review and working state. Reviewing or closing
never imports a model, appends Undo, publishes receipts, persists data or grants
Apply consent. The review reducer uses core's navigation-only history-review
adapter; working editing actions and other review entry points remain blocked
while a descriptor review/read is active. Finish conflicting edits/reads/renders
before opening. The left sidebar and single canvas remain the presentation shell.

Show source package version, namespace, model name and revision alongside source
coverage, native semantics and all loss/unverified findings. These are host-authored
claims, not authenticated provenance or runtime verification. Findings remain
visible independently of diagnostic/minimal-mode settings. Use existing native
DDD/EventStorming shells and theme tokens for light/dark previews. No Apply button.
Exact beta.85, two upstream strict-optional failures and unpublished native-core
requirements remain explicit; this slice grants no broader SDK compatibility.

## Alternatives and consequences

Direct `JSON.parse` discards duplicate-key evidence and constructs unbounded depth
before validation. Calling `/domain` in the browser would mix trusted executable
inspection with user data. Reusing the working editor would risk Undo/selection and
model ownership. A separate full page would break the existing workbench layout.
The selected approach adds a private host scanner (following the existing patch
text preflight) and a detached review state, with deliberate read-only restrictions.
The portable package's object contract remains unchanged. No new general JSON API.

## Implementation and verification

Add `alchemy-text.ts` for host parsing, `alchemy-state.ts` for dependency-free model
initialization and `alchemy-review.ts` for Foldkit update/view integration. Wire
messages, file Command, sidebar/canvas routing and the private workspace dependency.
Bundle a synthetic bank descriptor as an explicit example, without the SDK.
Test duplicate escaped keys, malformed/framed/oversize/deep/value-heavy input,
provenance, exact losses, read-only navigation/edit rejection, stale/cancelled/invalid
UTF-8 reads, previous-review retention and working-state preservation. Exercise the
built app in Chromium, retain light/dark captures, inspect them and record limits.
Run root typecheck/check/all tests and workbench production build sequentially.
Rollback is revert of this local app/docs/dependency change; no external state or
stored schema changes. Recommended follow-up remains reviewable only: source-fact
navigation linking findings to the detached canvas; no execution or Apply implied.
