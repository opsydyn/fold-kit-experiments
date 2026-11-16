/**
 * What players in the room say to one another, and who else is here: schemas only,
 * shared by the Model, the Messages and the presence Commands (see `presence.ts`).
 */
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

/** The channel every room page of this site speaks on. */
export const channelName = 'effect-three-room';

/** How often a presenting player says where they are, in seconds. */
export const reportSeconds = 0.05;

/** How long a player may go unheard before the others stop showing them. */
export const quietMilliseconds = 2000;

/**
 * What players say: where they are (latest wins, so nothing waits for it), and that they
 * have left the session or the page.
 */
export const Wire = Schema.Union([
  Schema.TaggedStruct('Pose', { peer: Schema.String, poses: SceneSchema.XrPosesDetail }),
  Schema.TaggedStruct('Bye', { peer: Schema.String }),
]);
export type Wire = typeof Wire.Type;

/** A relay between machines (`?relay=ws://host:port/room`), as the editor's. */
export const Relay = Schema.Struct({
  url: Schema.String,
  link: Schema.Literals(['Connecting', 'Open', 'Lost']),
});
export type Relay = typeof Relay.Type;

/** Another player presenting the room: where they last said they were, and when. */
export const Other = Schema.Struct({
  peer: Schema.String,
  poses: SceneSchema.XrPosesDetail,
  at: Schema.Number,
});
export type Other = typeof Other.Type;
