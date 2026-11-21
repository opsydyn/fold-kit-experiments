# ADR 0124 — Stream Questmancer room updates

Provisional for the localhost Moonwell prototype on 2026-11-21. Review at the
next staging qualification.

## Context

[ADR 0122](0122-open-private-questmancer-tables-from-teams.md) gives each
table a SQLite Durable Object. The browser repeatedly requests the room and
published Ledger, including when both are quiet. A lost connection also needs
a way to catch up with room changes made in its absence.

## Decision

Use one hibernatable WebSocket per open table page. The Astro endpoint checks
the request origin and current Teams membership. The room checks that the
authenticated account has joined and attaches the room role and a short
delivery lease to the connection. The private Worker forwards the upgrade to
the room. Durable writes finish before the room sends a change notice.

The socket sends only `room` and `party-ledger` notices. Room changes notify
everyone. Artwork preparation notifies the DM. A party Ledger notice follows
publication. Private notes and Ledger edits stay in the DM’s HTTP view.
Clients read the latest authorized state over the existing HTTP routes on
connect and after each relevant notice. They stop reconnecting if that read
denies access.

## Trade-offs

Compared with fixed polling, notices avoid idle state reads. Compared with
streaming snapshots, notices reuse the same authorization and role projection
for every state read, at the cost of a fetch after a change. A disconnected
client resynchronizes from current state, so the room needs no replay log.

The delivery lease is checked on fanout. Expiry closes the socket on the next
applicable change and the browser has to authenticate again. Session or team
revocation can leave a socket connected until it attempts a read or its lease
ends at fanout. An already connected client could observe a content-free
notification during that window. Every HTTP read still checks current access.

## Verification

Use the existing four-browser localhost test. Check idle request counts,
reveal to connected players, catch-up after disconnect, and the absence of
private job content and Ledger changes on player sockets. Cloudflare-hosted
hibernation and billing are part of staging qualification.
