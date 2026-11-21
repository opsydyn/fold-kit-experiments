# ADR 0120 — Deploy Teams staging on demand

Accepted 2026-11-19. The user approved a standalone Teams staging button,
focused checks and measurement through the hosted smoke check.

## Context

The OPY release waited 22 minutes 36 seconds for post-merge CI. The Alchemy apply
took 39 seconds. Teams uses workspace source and its own Alchemy staging stack.
The Zloz npm release train publishes packages independently.

## Decision

Add a manual GitHub Actions workflow for the exact `main` commit captured at
dispatch. Use frozen dependencies, focused Teams checks, and the existing Alchemy
stack and state. The `teams-staging` GitHub environment admits only `main`.
Keep deployments serialized and let an active deployment finish. Use
environment-scoped GitHub Actions variables for the approved email sign-in
and Questmancer settings. The plan still requires their existing bindings to
be no-ops.

Inspect Alchemy's structured plan under its stage lease. The quick path allows
in-place updates to the two existing staging Workers and preserves their
non-build settings. Resource creations, replacements, deletions, binding changes
and stack actions require the reviewed staging path. Apply the inspected
snapshot within the same lease.

Publish a build marker containing the public commit SHA and Actions run
identity. Verify it on the staging origin before checking anonymous session
behavior, Google configuration and the sign-in shell. Report elapsed time from
GitHub run creation to the last successful smoke request. This includes runner
queue time.

## Alternatives and trade-offs

Waiting for the whole workspace suite couples staging iteration to unrelated
browser installs and tests. That suite remains the PR merge gate. The manual
local Alchemy commands remain available for reviewing a larger staging change.
An automatic push trigger would update the shared board on unrelated merges.
The manual workflow gives the operator control over when shared staging changes.

The guard checks Alchemy resource and Worker settings. Compatibility of persisted
event codecs still relies on the tests and code review. The hosted smoke check
covers the served artifact and auth endpoints. The interactive Google sign-in and
two-account collaboration journeys have their own qualification checks.
