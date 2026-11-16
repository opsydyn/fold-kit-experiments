# ADR-020: Other players are shown from poses they report, beside the lockstep session

- Status: Accepted (2026-11-16).
- Evidence: `packages/effect-three/test/presence.test.ts` (poses off by default and part
  of the settings' equality, saved and read with a scene and absent from older files; a
  pose report becomes an `XrPoses` event as it came; an avatar's head turned as the pose
  is, its untracked hands left out, its parts easing over the report interval; avatars
  saved and read back unchanged); `packages/effect-three-foldkit/e2e/xr.test.ts` (Meta's
  IWER emulating a Quest 3 in Chromium: with `xr({ poses: 0.1 })` about ten reports a
  second, the head where the player stands and facing where they face in the scene's
  space, both grips reported, nothing once the session ends, and nothing without
  `poses`); `packages/effect-three-samples/test/room.test.ts` (a named page says where its
  player is, through the channel or the relay; others drawn where they said, a newer pose
  replacing the older in place, gone on `Bye` or after two quiet seconds; the page's own
  words ignored); and headless Chromium on the promo's room: one context presenting in an
  emulated headset, another plain page in a separate context, through `bun run relay`
  and, in one context, over the channel. The plain page read "1 other player is in the
  room" and drew the avatar where the headset stood; when the headset exited, it was gone.
- References: pmndrs/xr at `0e1acd8`: `space.ts` (a space's pose read from the frame in
  the origin's reference space, none while untracked) and `examples/avatar` (a rigged
  avatar driven by body tracking, for the player and a mirror, on one machine: it has no
  networking). Networked VR libraries commonly send each avatar's transforms at a fixed
  rate, latest wins, and interpolate between updates; that is the shape taken here.
  ADR-008 (immersive sessions), ADR-013 (lockstep and the relay).

## Context

Roadmap "Beyond parity" 2 ends with co-presence: in a shared session, each player sees
the others' heads and hands. A session already tracks the player's own head and hands
for groups that follow them (`group({ follow })`), but only on this machine, frame by
frame, outside the Model. Another player's head is not a space this session tracks; it
is something the Model has heard.

## Decision

- **`xr({ poses })` reports, it does not track.** With `poses` set to a number of seconds,
  a presenting session reports `XrPoses { head, left, right }` that often: the viewer's
  pose and each hand's grip (`null` when not tracked) in the scene's space, after the
  player's origin, heading and gliding. `null`, the default, reports nothing. The Model
  sends what it likes of that to whom it likes; the packages do not network.
- **Poses travel beside the lockstep session, not through it.** A pose is state, not an
  input: only the newest matters, nothing in the world depends on it, and no peer must
  apply it in the same order. Sent through lockstep turns, every pose would wait for the
  slowest member and the session's lead, and a lost one would hold every turn up. So the
  room sample sends `Pose` and `Bye` on the same transport the editor and tabletop use
  (a `BroadcastChannel` between tabs, the relay between machines), keeps the newest pose
  from each other player, and lets a player go after two seconds without one. An app
  with a lockstep session sends them on its own Wire beside `Turn`, as plain messages.
- **`avatar(key, poses)` is ordinary scene nodes.** A group with a head (a visor on the
  face it looks from) and a sphere for each tracked hand; each part eases to its new
  place over the report interval (`transition: ease`), so a player moves smoothly
  between reports at 20 a second. Being plain nodes, avatars are saved, diffed, previewed
  and checked like anything else.

## Consequences

- An avatar is about one report behind the player, plus the network, as lockstep inputs
  are behind by the session's lead. Positions ease between reports; rotations step to
  each new pose, because transitions ease position and scale only. At 20 reports a
  second a turning head steps visibly but slightly; easing rotations, by slerp, is a
  change to transitions for every node, left for when it is wanted.
- A report is a Message: at 20 a second the presenting page updates and renders 20 times
  a second more, and each other page as often for each player. Fine for a room of a few;
  a crowd would want reports batched per frame or kept out of the Model.
- Poses are trusted as relayed: there is no sign-in (ADR-013). A page can say it is
  anyone and stand anywhere.
- Body tracking (pmndrs/xr's `bodyTracking`) and rigged avatars are not attempted; a
  full body would be more joints in the same report.
- Checked under emulation only: a real headset's grips, especially tracked hands', are
  among the real-device checks still to do.
