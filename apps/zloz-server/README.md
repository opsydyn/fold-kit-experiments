# ZLOZ private backend

Private Alchemy Worker for the team app. Better Auth owns sessions and
organization membership in D1. The first-class Alchemy adapter owns the diagram
aggregate and public live view. The original title probe remains only as a
qualification surface; graph mutations use the guarded diagram dispatcher.

`src/worker.ts` independently validates cookie sessions, Origin, current tenant
membership and read/edit permission. It ignores caller identity/role headers.
Organization deletion is unavailable in this MVP. The read context carries user
and session IDs, not a cookie or an editable room role. Reads on an open socket
check the current D1 session and membership before every delivery. An idle socket
ends after 25 seconds and must reconnect. The relay holds a Worker active and its
cost is unmeasured; qualify load/cost before a pilot.

`migrations/0001_auth.sql` is generated from pinned Better Auth/plugin options.
Automatic Better Auth migrations are disabled. Alchemy D1 applies the checked-in
migrations, including statement-level last-owner protection, allowed membership
roles and unique membership. A losing concurrent owner operation currently fails
closed with a library error; the future owner UI needs a recoverable conflict
outcome and a refreshed member list. The triggers also prevent cascading deletion
of a team's final owner, so organization/account deletion requires a separately
designed lifecycle.

To regenerate the initial schema for review in an empty development checkout:

```sh
bun run --filter @opsydyn/zloz-server generate:auth-schema
```

Never rewrite an applied migration to upgrade an existing database. Add and
review a forward migration, preserve the owner/role/uniqueness constraints, and
test populated data. The auth tests ask Better Auth's migration planner to check
that the reviewed schema has no missing tables, columns or required indexes.

The test suite uses actual local D1 with the production options/schema. It
covers signed sessions, invitation identity/verification/expiry/cancellation,
duplicate acceptance, and barrier-controlled competing owner demotions/removals.
Removing the guard migration makes both owner tests fail with zero owners.

The separate test fixture Worker is a local harness, not an application endpoint.
Alchemy's local multi-Worker D1 emulator reported SQLite locks during parallel
fixture creation. Runtime tests seed fixtures sequentially; they do not establish
production concurrency capacity. Keep the planned load/staging gates.

## Shared diagram boundary

`diagram-routes.ts` derives the actor from the signed session and checks current
team membership for create/open/operation/export/presence requests. Editor writes
pass through the adapter's bound dispatcher; viewers only read and send presence.
The read-only `/api/zloz/live` API uses fresh authorization on every delivery.
The app exposes no native aggregate mutation RPC or private inverse journal.

Creation commits the graph first, then idempotently inserts immutable name/ID
metadata into D1. Retrying the same ID, graph and name repairs an interrupted
insert; no D1/Domain distributed transaction is claimed. Operation directory
timestamps are best effort and cannot turn a committed edit into a failed reply.
Updates within one second of the stored timestamp leave it unchanged, so directory
recency can lag by up to one second while canonical content and receipts retain
their complete durable history. Older completions cannot regress the timestamp.
Export reads canonical aggregate state and serializes only its graph.

`presence.ts` creates a volatile Map inside each diagram DO instance: 15-second
TTL, at most 32 tabs, no SQL/events and no cookies in peer data. Every heartbeat
passes current auth at the Worker boundary. Pilot policy limits authored graphs
to 250 nodes, 500 edges and 1 MiB; request bodies are bounded before decoding.
Auth/onboarding requests retain their original 8 KiB body limit.

The guarded test-only operation Worker has explicit before-commit and
committed-before-reply fault points. The runtime suite kills/restarts only its
isolated local stack and checks graph/receipt/directory recovery and volatile
presence loss. These are local workerd tests, not hosted fault-injection or load
acceptance.
