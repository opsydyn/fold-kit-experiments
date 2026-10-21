/**
 * What tabletop peers say to one another, and where a peer is in a session: schemas only,
 * shared by the Messages and the session's Commands (see `session.ts`).
 */
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { Paint } from '../palette';

/** The channel every tabletop tab of this site speaks on. */
export const channelName = 'effect-three-tabletop';

/** How often a peer sends its turn packet, in milliseconds. */
export const turnMilliseconds = 50;

/** Physics steps (of 1/60 s) a turn stands for: a turn's inputs land at its first. */
export const stepsPerTurn = 3;

/** How long a turn may wait on a quiet peer before the leader drops it. */
export const quietMilliseconds = 3000;

/** How long a new peer waits for a welcome before it starts a session of its own. */
export const joinMilliseconds = 1500;

/** Every so many steps (a second), each peer shares its world's checksum. */
export const checkEvery = 60;

/** A ball thrown onto the table: where it starts, and the push it gets. */
export const Throw = Schema.TaggedStruct('Throw', {
  from: SceneSchema.Vec3,
  impulse: SceneSchema.Vec3,
  paint: Paint,
});
export type Throw = typeof Throw.Type;

/** A ball on the table: the throw that made it, kept until the table is cleared. */
export const Ball = Schema.Struct({
  key: Schema.String,
  from: SceneSchema.Vec3,
  impulse: SceneSchema.Vec3,
  paint: Paint,
});
export type Ball = typeof Ball.Type;

/**
 * Where a newcomer's world can start: the leader's snapshot of its world at a check step,
 * and the table as it was there (its balls, how many were thrown, how often the tower was
 * built), before the inputs due at that step.
 */
export const Start = Schema.Struct({
  step: Schema.Int,
  snapshot: Schema.String,
  balls: Schema.Array(Ball),
  thrown: Schema.Int,
  build: Schema.Int,
});
export type Start = typeof Start.Type;

/** The tower built again, and the balls cleared away. */
export const Rebuild = Schema.TaggedStruct('Rebuild', {});

/** What changes the world: what the timeline holds, and a newcomer replays. */
export const Play = Schema.Union([Throw, Rebuild]);
export type Play = typeof Play.Type;

/** A peer's checksum of its world at a step, for the others to compare with theirs. */
export const Check = Schema.TaggedStruct('Check', {
  step: Schema.Int,
  checksum: Schema.String,
});

/** What a peer puts in its turn packets. */
export const Input = Schema.Union([Throw, Rebuild, Check]);
export type Input = typeof Input.Type;

const Packet = SceneSchema.LockstepPacket(Input);
export type Packet = typeof Packet.Type;

/** What peers say to one another. */
export const Wire = Schema.Union([
  Schema.TaggedStruct('Hello', { peer: Schema.String }),
  Schema.TaggedStruct('Turn', { packet: Packet }),
  /**
   * A newcomer's start: the session as it is, and every throw and rebuild so far, with
   * its step. With a `start`, the newcomer's world starts from the leader's snapshot and
   * replays only what came after it; without, it replays the record from step 0.
   */
  Schema.TaggedStruct('Welcome', {
    to: Schema.String,
    turn: Schema.Int,
    lead: Schema.Int,
    members: Schema.Array(SceneSchema.LockstepMember),
    record: Schema.Array(Schema.Struct({ step: Schema.Int, input: Play })),
    start: Schema.optionalKey(Start),
  }),
  Schema.TaggedStruct('Bye', { peer: Schema.String, until: Schema.Int }),
  Schema.TaggedStruct('Drop', { peer: Schema.String, until: Schema.Int }),
]);
export type Wire = typeof Wire.Type;

/**
 * A relay between machines, when the page names one (`?relay=ws://host:port/room`): its
 * address, and whether this peer is connecting, connected, or has lost it.
 */
export const Relay = Schema.Struct({
  url: Schema.String,
  link: Schema.Literals(['Connecting', 'Open', 'Lost']),
});
export type Relay = typeof Relay.Type;

/** Where this peer is in a session. */
export const Session = Schema.Union([
  /** Not in one: just opened, or stepped out while the page was hidden. */
  Schema.TaggedStruct('Offline', {}),
  /** Said hello; keeping what it hears until it is welcomed or gives up waiting. */
  Schema.TaggedStruct('Joining', { self: Schema.String, heard: Schema.Array(Packet) }),
  Schema.TaggedStruct('Live', {
    lockstep: SceneSchema.Lockstep(Input),
    /** The turn the session is waiting on, and since when, while it waits. */
    stalled: Schema.Option(Schema.Struct({ turn: Schema.Int, since: Schema.Number })),
  }),
]);
export type Session = typeof Session.Type;
