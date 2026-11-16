# ADR 0115: Serialize Zloz publication with registry verification

Accepted, 2026-11-16. Authority: the user approved automating dependency ordering
and registry verification, shipping the documentation fixes as 0.6.1, tests and
commit. This extends the publication mechanism in ADR 0036; package APIs and
the accepted Node/browser baseline are unchanged.

## Context and decision

The four 0.6.0 packages were published through separate manual dispatches with
operator-managed ordering and registry checks. Adapters pin the exact core peer;
Force also needs the published Viz dependency. Independent dispatches can race or
leave a family partially available without a durable account of the last verified
stage. A green upload alone does not establish registry availability.

Use one reusable/manual `zloz-release-train` workflow. Release-please invokes it
after creating the linked family release; manual dispatch is its recovery path.
One global family concurrency group serializes runs without cancelling an active upload. Remove Zloz
from the independent publisher. Keep existing npm credentials, Node 24, pinned
Actions and npm provenance; no new dependency or credential configuration.

Require a full immutable product release SHA, all four component tags at that SHA,
matching stable versions/exact core peers and private CLI/Alchemy. Check out the
workflow event SHA, which is the source recorded in npm provenance. Normally these
SHAs are identical. Recovery may use repaired release automation only when every
package and build input remains identical to the tagged product; the exact allowed
control/documentation paths are enumerated in `assertControllerSource`. Wait for
successful push CI on both identities when they differ,
then qualify every archive through the existing build/Publint/ATTW checks before
the first publication. Publish core, ELK, Force, Mermaid, in that order.

At each barrier, download registry metadata, archive and SLSA provenance. Check
identity, peers/dependencies, exact candidate SHA-512 bytes, subject identity and
digest, structured repository/source commit. A clean registry consumer performs
`npm audit signatures`, validating signatures/provenance before advancement. The
final Node consumer exercises the installed family together. No standalone Bun
ELK support or human device/assistive-technology acceptance is inferred.

Read all existing target versions and external runtime dependencies before any
write. A rerun verifies existing versions and skips publication; any mismatch
stops. Retry bounded transient registry reads/propagation, never an uncertain npm
upload. Failed upload or verification blocks all downstream writes. Retain checked
archives and incremental success/failure receipts as workflow artifacts.

## Alternatives and consequences

- Four manual dispatches retain the demonstrated operator burden and bypass risk.
- A parallel matrix violates exact-peer availability ordering.
- A new release platform or package manager adds unnecessary migration risk.
- A single serialized workflow reuses existing tooling and makes partial progress
  visible. It costs sequential runtime and cannot roll back an immutable upload.

Recovery is a rerun at the same tag/SHA after inspecting the retained receipt, or
a manual dispatch from trusted main with the original product SHA when release
automation itself needs repair. Report both the product release SHA and actual
publication source SHA; never pretend repaired controller source is the old tag.
GitHub retains at most one pending run per concurrency group; a newer dispatch can
replace an older pending run, which then needs manual recovery at its release tag.
If rebuilt bytes differ, stop and inspect the retained candidate; never overwrite,
unpublish, move tags, blindly retry publication or silently accept a different
archive. The family lock cannot control workflows from historical source refs;
operators must use the new train, including recovery.

## Implementation and evidence

- `.github/scripts/zloz-release-train.mjs`: validation, registry barriers,
  resumable publication and receipts; native IO remains at this process boundary.
- `.github/scripts/zloz-registry-consumer.mjs`: actual installed-package checks.
- `.github/workflows/zloz-release-train.yml`, `release-please.yml`, `publish.yml`:
  shared entry, scoped credential exposure, source CI and one family lock.
- Root test script and Moon root test include train regression tests. Exercise
  wrong tags/versions/peers/private identities, partial rerun, missing external
  dependencies, read/upload/integrity/signature failures and downstream stopping.
- Run root check/typecheck/tests, clean CI and hosted PR/release checks; record
  exact source identity and independent registry readback for 0.6.1.

Architecture, delivery and test-quality review are self-review. No additional
public packages, API features, dependency upgrades or hosting changes are in scope.

Local qualification before publication: root `bun run check`, `bun typecheck` and
`bun run test` passed. The 10 train tests passed; temporarily removing the signature
barrier made the suite fail. Official actionlint 1.7.12 accepted the changed
workflows. Two packs of the same candidate had identical SHA-512 bytes. The new
registry consumer passed against installed 0.6.0; npm verified signatures and
attestations for all six installed packages. These are local/pre-existing-registry
observations, not evidence that 0.6.1 has been published.

## First hosted execution and recovery correction

Run 43932482750 validated the four immutable 0.6.1 tags at `b68c8f15`, waited for
all four source CI jobs to pass, then stopped before packing or uploading: the
qualification shell omitted `REQUESTED_PACKAGE` when invoking the existing
single-package identity guard. No 0.6.1 npm upload occurred. The added regression
executes that actual workflow shell against the real guard, substituting only the
external package-build boundary; it reproduced the missing-input failure before
the fix and verifies all four guard/pack pairs afterwards.

Fix the invocation for each package. Because release tags already exist, retain
them and distinguish the repaired workflow/source from the tagged product.
Reject recovery if any path outside the six enumerated release-control/doc paths
differs: package sources/manifests/READMEs, root manifests/lockfile, build tools,
CI policy and all other inputs must remain identical. CI must pass on controller
and product commits. Published provenance names the actual controller/source SHA;
receipts retain the product SHA and independently compare downloaded package
README bytes with that original tag. Do not disable or weaken identity checks.
