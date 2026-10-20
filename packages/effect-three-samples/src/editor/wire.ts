/**
 * What editor tabs say to one another, and where a tab is in a session: schemas only,
 * shared by the Messages and the session's Commands (see `session.ts`).
 */
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { Edit } from './edit';

/** The channel every editor tab of this site speaks on. */
export const channelName = 'effect-three-editor';

/** How often a tab sends its turn packet, in milliseconds. */
export const turnMilliseconds = 50;

/** How long a turn may wait on a quiet tab before the leader drops it. */
export const quietMilliseconds = 3000;

/** How long a new tab waits for a welcome before it starts a session of its own. */
export const joinMilliseconds = 1500;

const Packet = SceneSchema.LockstepPacket(Edit);
export type Packet = typeof Packet.Type;

/** What tabs say to one another. */
export const Wire = Schema.Union([
  Schema.TaggedStruct('Hello', { peer: Schema.String }),
  Schema.TaggedStruct('Turn', { packet: Packet }),
  Schema.TaggedStruct('Welcome', {
    to: Schema.String,
    turn: Schema.Int,
    lead: Schema.Int,
    members: Schema.Array(SceneSchema.LockstepMember),
    nodes: Schema.Array(SceneSchema.SceneNode),
    resources: SceneSchema.ResourceDefinitions,
    history: SceneSchema.History(Schema.Array(SceneSchema.SceneNode)),
  }),
  Schema.TaggedStruct('Bye', { peer: Schema.String, until: Schema.Int }),
  Schema.TaggedStruct('Drop', { peer: Schema.String, until: Schema.Int }),
]);
export type Wire = typeof Wire.Type;

/**
 * A relay between machines, when the page names one (`?relay=ws://host:port/room`): its
 * address, and whether this tab is connecting to it, connected, or has lost it (or never
 * reached it). Without one, tabs of this browser find each other over the channel.
 */
export const Relay = Schema.Struct({
  url: Schema.String,
  link: Schema.Literals(['Connecting', 'Open', 'Lost']),
});
export type Relay = typeof Relay.Type;

/** Where this tab is in a session. */
export const Session = Schema.Union([
  /** No channel yet (or none at all, as in tests): Edits apply here directly. */
  Schema.TaggedStruct('Offline', {}),
  /** Said hello; keeping what it hears until it is welcomed or gives up waiting. */
  Schema.TaggedStruct('Joining', { self: Schema.String, heard: Schema.Array(Packet) }),
  Schema.TaggedStruct('Live', {
    lockstep: SceneSchema.Lockstep(Edit),
    /** The turn the session is waiting on, and since when, while it waits. */
    stalled: Schema.Option(Schema.Struct({ turn: Schema.Int, since: Schema.Number })),
  }),
]);
export type Session = typeof Session.Type;
