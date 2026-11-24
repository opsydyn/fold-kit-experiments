# ADR 0127 — Trial mutation testing on web pull requests

Proposed for the apps/web trial on 2026-11-23.

The [local trial](../spikes/mutant-cafe.md) found a layout bug and missing
command assertions. The web app already runs Vitest 5 and CI provides Node 24.
Install Mutant Cafe 0.1.7 from the separate npm lockfile in
`tools/mutant-cafe`. Local and CI runs use the same dependency versions,
and the tool’s copy of Effect stays outside the Bun workspace. Keep the existing required CI checks as the merge gate.

The advisory job tests changed TypeScript bodies under `apps/web/src` against
the PR head. It uses one mutation worker and runs at most 20 mutants in path order.
The baseline has five minutes within the 30-minute job limit, so it can report a timeout.
Its Actions summary and `web-mutation-outcomes` artifact record selection,
execution, outcomes and baseline failures. A zero selection skips the baseline.
A failed baseline leaves the test quality of the changed bodies unknown.

Review the first three PRs with executed mutants for useful misses, unreliable
results, skipped candidates and elapsed time before changing the budget or
adding workspaces. A whole-app run costs more per PR, and a minimum mutation
score would penalise equivalent replacements identified in the local trial.
