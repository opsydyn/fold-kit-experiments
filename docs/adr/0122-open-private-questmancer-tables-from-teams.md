# ADR 0122 — Open private Questmancer tables from Teams

Accepted for localhost qualification on 2026-11-19. Hosted qualification follows a reviewed staging plan.

## Contract and decision

Proceed with one Moonwell table per enabled team. A Teams owner can start the table and choose exactly three distinct teammates. Their invitations assign Mira, Brasswick and Wicket. Current Teams membership controls access on every request. The session owner is the DM. The DM previews art and publishes the party recap explicitly. Drafts, private notes and invitation membership stay within the authenticated boundary.

The Astro app owns sign-in, membership and the dashboard. It reconstructs a private service request using trusted account and team data. The Questmancer Worker has no public route. One SQLite Durable Object per team owns invitations, positions, jobs and the Ledger. Workflows process art outside the room’s transaction, and private R2 stores drafts and revealed assets under team-specific keys.

The staging flag defaults off. Staging has one explicitly configured pilot team. The first build uses the preserved Moonwell art through the real Workflow and R2 path. Live inference needs a portable image pipeline and separate hosted qualification. Keep the existing staged Teams stack and diagram routes.

## Trade-offs

Port the verified room, Ledger and FoldKit/Zloz board from the localhost pilot. Reuse Teams invitations for people outside the team before giving them a seat. Using the old loopback tickets would bypass Teams membership. Extending diagram roles to imply DM access would expose private content. Staging stays reversible by disabling access and retaining the existing room bindings and data.

## Verification

Run the complete four-browser journey against the local Alchemy stack with synthetic Teams accounts. Check uninvited and removed members, spoofed roles, other-token movement, draft retrieval, publish and reconnect. A player receiving any private field or draft bytes fails the slice.

## Owner preview before live play

An independently configured staging team lets its current owner open a sample
board before player accounts are ready. Astro verifies Teams membership and the
owner role before returning the preview and its sample backdrop and sprite.
The page uses the same tabletop renderer in read-only mode. Viewport controls
run entirely in the browser. Clearing the preview setting closes the route.
The existing live table entry and party seat rules continue to apply.
