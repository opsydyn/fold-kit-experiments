# AG-UI Local Merge Checkpoint

## Scope

The user authorised a local merge and documentation on 2026-10-11. The reviewed
commits from `codex/ag-ui-agent-analysis` through `3b7fbeb` are the merge scope.
No push, deployment or package release is included.

- [x] Validated AG-UI contract, run Model and pure update transitions.
- [x] Request-scoped SSE fixtures, input validation and 16 KiB byte limit.
- [x] Effect Stream response bridge with scoped producer cleanup.
- [x] App-owned client stream subscriptions and navigation policy.
- [x] Internal Astro client-island retention and remount repair.
- [x] Document retained-island ownership and init-only props in the package README.
- [ ] Review and commit the chart UI, route hosts and browser harness.
- [ ] Complete full desktop/mobile acceptance and CI browser configuration.
- [ ] Qualify compiled Cloudflare endpoint streaming on a local emulator.
- [ ] Complete independent whole-slice review and maintained example guide.

## Architecture

The AG-UI endpoint is a deterministic fixture, not a production agent backend.
It validates SDK input and app-owned scenario data before returning encoded SSE.
Invalid input returns 400, proven byte overflow returns 413 without awaiting
source cancellation, and unexpected body-read failures return a generic 500.
Producer defects after response creation fail the body rather than fabricating
a validation response. Abort and consumer cancellation stop scoped production;
an aborted body read or cancellation can reject.

The application owns run identity, accepted-event policy and subscriptions.
Astro supplies lifecycle facts. Viz primitives do not acquire transport or agent
responsibilities. The integration repair mounts FoldKit inside the Astro-owned
host, shares active initialization and sequences genuine remounts through the
public embed API. Props remain init-only for an active runtime.

## Evidence Boundary

Local main was fast-forwarded from `16bed58` to `3b7fbeb`, preserving its five
pre-existing local commits. Fresh checks on that merged source, with the
documentation updates, passed:

| Command                               | Result                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| `bun install --frozen-lockfile`       | Exit 0; lockfile unchanged                               |
| `bun run check`                       | Exit 0; lint and formatting pass                         |
| `bun typecheck`                       | Exit 0; web reports zero errors, warnings and hints      |
| `bun run test`                        | Exit 0; 706 pass, one existing promo skip, zero failures |
| `bun run --filter @opsydyn/web build` | Exit 0                                                   |

Logs: `/tmp/agui-main-{check,types,tests,build}.log`. The nine additional UI tests
from the managed worktree are not part of the merged-main test count. The two
background Astro daemons left by the pre-merge and merged-main test runs were
identified by exact process, checkout and test build stamp, then stopped.

The preceding managed-worktree qualification recorded 715 passing workspace
tests, one existing promo skip, and four passing local desktop/mobile smoke
cases. Those runs included the still-uncommitted UI and browser harness; they
are not evidence that the demo UI has landed on main or that browser CI and the
compiled Worker endpoint are qualified.

The unreviewed demo files and their detailed qualification record remain in the
managed `ag-ui-agent-analysis` worktree. Keep that worktree and its ignored proof
artifacts until the remaining tasks are reviewed and integrated. Do not archive
it merely because its committed branch has been merged.

The Astro integration smoke harness can leave a background Astro daemon after
stopping its Bun wrapper. Task 5 should establish foreground process ownership
or explicit daemon shutdown. Test-run cleanup must identify the exact owned
process, checkout and test build stamp; unrelated development servers are not
cleanup targets.

Screen-reader acceptance, deployed behaviour, npm publication and cancellation
of real backend compute remain unqualified.
