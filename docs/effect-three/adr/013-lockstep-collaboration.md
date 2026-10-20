# ADR-013: Peers stay in step by applying the same inputs in the same order

- Status: Accepted (2026-10-20), for editing together, between tabs and (since
  2026-10-20) between machines through a relay; physics in lockstep is ADR-014.
- Evidence: `packages/effect-three/test/lockstep.test.ts` (three peers over a simulated
  network with seeded random delays and reordering, joining late, leaving and going
  quiet, five seeds: every peer's log identical; a newcomer whose id sorts first);
  `packages/effect-three-samples/test/editorSession.test.ts` (two and three editor
  Models wired through `update`); two real tabs of headless Chromium on the promo's
  editor (joined, edits from both in one shared history, undo on one undoing for both,
  a closed tab let go), run repeatedly so both id orders occur. For the relay:
  `packages/effect-three-samples/test/relay.test.ts` (real sockets: every other peer in
  a room hears each message in order, the sender and other rooms do not, closing the
  relay closes its sockets), the relay cases of `editorSession.test.ts` (hello once the
  socket opens, a lost or unreachable relay leaves the tab editing alone, reconnecting
  as a newcomer, every message crossing as JSON unchanged), and headless Chromium with
  separate browser contexts, which share no `BroadcastChannel`: two editors joined
  through a local relay, edited and undid together, a third joined late with the
  document, a closed one was let go; with the relay stopped both edited on alone, and
  after it restarted, Reconnect brought them back into one session. Without the relay
  the same two contexts could not see each other.
- References: classic deterministic lockstep (turns that apply only when every peer's
  input for them is in); ADR-011 for why a deterministic `update` is enough.

## Context

Roadmap "Beyond parity" 2: if every peer runs the same `update`, sharing the input
stream shares the world. The editor is the first case: its Edits are pure functions of
the document, so no physics determinism is needed yet.

## Decision

- **The protocol is pure kernel data (`Lockstep`), the transport is the app's.** Time
  is cut into turns; each member sends one packet per turn (empty when idle); a turn
  applies when every member's packet for it is in, inputs in peer-id order. A peer may
  send at most `lead` turns ahead, so an input waits about `lead` turns.
- **Membership changes are turn inputs.** The leader (the member whose id sorts first)
  admits a newcomer with an entry in its packet; when that turn applies, everywhere at
  once, the newcomer becomes a member `lead + 1` turns later, and the leader of the turn
  before then sends it the state to start from (`welcomeDue`). Leaving says the last
  turn sent; a quiet member is dropped by the leader from the turn everyone waits on,
  which no one can have applied.
- **The editor's shared changes are Edits; the rest is each tab's own.** Add,
  duplicate, delete, place (a gizmo drag, on release), field edits, undo, redo, jump and
  open go through the session; selection, camera, hover and drags in progress stay
  local. Keys for new things come from the document when the Edit applies, so they are
  the same everywhere. A tab without a channel (tests) applies Edits at once.
- **Tabs talk over a `BroadcastChannel`.** Hello, Turn, Welcome, Bye and Drop, each
  schema-decoded on arrival. A tab that hears no welcome in 1.5 s starts a session of
  its own, and one still alone takes a welcome that comes late.
- **Between machines, a relay that only relays.** `bun run relay` serves rooms (a URL
  path each) and hands each message to every other socket in the room, as a
  `BroadcastChannel` does, reading none of them; it is a sample, not part of the
  packages, as the transport is the app's. A page with `?relay=ws://host:port/room`
  uses it instead of the channel: the same Wire, as JSON text, decoded on arrival. The
  socket is a Foldkit managed resource, held while the Model names a relay it has not
  lost, with the tab's name in its requirements; the tab says hello once it opens. A
  socket that never opens, or closes, leaves the tab in a session of its own with its
  document; Reconnect names it afresh, so it rejoins as a newcomer and takes the
  session's document if there still is one.

## Consequences

- Tabs of one browser edit together with no server; machines need a relay, which can
  be anywhere Bun runs, holds nothing, and trusts no one: there is no sign-in, and
  anyone who knows a room's address can join it. The relay is for trying this out on
  a network one trusts; an app that wants more puts its own server behind the same
  Wire.
- Over a network, an Edit waits about the longer of the session's lead and the trip
  through the relay, and the session goes at the pace of its slowest member's link.
- Edits made while a tab is cut off stay in its own copy: reconnecting takes the
  session's document, as joining always has. Merging the two is not attempted.
- The session moves at the pace of its slowest member, and a frozen tab holds others
  up for three seconds before it is dropped.
- Two tabs opened within the same moment can each start a session alone; they do not
  merge. A drag is seen by others when it is released, not as it moves.
- Physics games need inputs applied at fixed simulation steps and Rapier's
  deterministic build (ADR-011): ADR-014 adds both, on this protocol.
