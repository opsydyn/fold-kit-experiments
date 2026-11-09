# ADR 0020: Pin supported CI runtimes and actions

## Status

Accepted for the requested CI repair and Actions audit, 2026-11-08.

## Context

Release-branch CI packed a force adapter requiring Viz 0.15.0 alongside the
0.16.0 Viz tarball. A minimal fixture reproduces the stale dependency on Bun
1.4.3, including after a frozen install; Bun 1.4.4 packs the current manifest
version. The offline consumer correctly rejected the mismatch. Existing actions
also used unsupported Node 20 runtimes, independently of the Node executable
selected by setup-node.

## Decision

Pin Bun 1.4.4 through the root packageManager in every setup-bun step. Retain
frozen installs and offline force-consumer qualification with an empty npm cache;
add a release-only version-bump packing regression to the root suite. Do not
weaken resolution checks or fall back to published packages.

Pin all eight external action identities across seven workflows to verified
release commit SHAs. Use current Node 24 action runtimes and explicitly set the
project CI Node executable to 24. Package engine contracts remain unchanged.
Use weekly grouped Dependabot updates for action pins. Disable implicit npm
caching in setup-node because this workspace uses Bun. Preserve publication
conditions, trusted changelog formatting boundaries, deployment destinations and
credential scopes. No release or publication is authorized by this migration.

Extend the trusted formatter's manifest/changelog allowlist to the four Zloz
release components and exercise first-release additions. Continue to reject
unexpected files, forks, symlinks and head races without executing PR code.

Patch development-only Happy DOM and its registrator together. Refresh the
isolated Mermaid research harness to the Zloz tarball and override its vulnerable
lodash-es transitives to 4.18.1 without changing mermaid-ast 0.8.2. Retain original
research evidence and qualify the changed harness separately.

## Alternatives and consequences

Removing offline installation would conceal metadata errors behind registry
resolution. Updating bun.lock in the trusted formatter would introduce a broader
write boundary when the runtime fix suffices. Floating action majors simplify
updates but make reviews less reproducible; SHA pins plus Dependabot retain an
explicit update path. The new runtime and dependency majors require full local
checks and hosted CI before the next release; workflow parsing alone cannot
qualify publishing, deployment or repository credentials.

Review: after the first hosted run on these action pins, before release.
