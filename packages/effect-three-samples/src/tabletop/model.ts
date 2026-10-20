import { perspectiveCamera, SceneSchema, Timeline } from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';

import { Paint } from '../palette';
import { NameTab } from './session';
import { Play, Relay, Session } from './wire';

/** A ball on the table: the throw that made it, kept until the table is cleared. */
export const Ball = Schema.Struct({
  key: Schema.String,
  from: SceneSchema.Vec3,
  impulse: SceneSchema.Vec3,
  paint: Paint,
});
export type Ball = typeof Ball.Type;

const Steps = Schema.Int;

export const Model = Schema.Struct({
  /** Every throw and rebuild, at the step it lands, and how far the world may go. */
  timeline: SceneSchema.Timeline(Play),
  /**
   * The world as the throws so far have made it: changed only when the world reaches
   * the step they land at, so it changes at the same step on every peer.
   */
  balls: Schema.Array(Ball),
  /** Balls thrown so far, for each new one's key. */
  thrown: Schema.Int,
  /** How many times the tower has been built, for its blocks' keys. */
  build: Schema.Int,
  /** This peer's run of the world: a new one when it takes a session's record. */
  run: Schema.Int,
  /** The step and checksum the world last reported. */
  reached: Schema.Option(Schema.Struct({ step: Steps, checksum: Schema.String })),
  /** This peer's checksums at the latest check steps. */
  checksums: Schema.Array(Schema.Struct({ step: Steps, checksum: Schema.String })),
  /** Other peers' checks for steps this peer has not reached yet. */
  awaiting: Schema.Array(Schema.Struct({ step: Steps, checksum: Schema.String })),
  /** Checks that matched this peer's world, and the first that did not. */
  agreed: Schema.Int,
  diverged: Schema.Option(Steps),
  /** The first step this peer shares checks for: where it joined. */
  checksFrom: Steps,
  /** The colour of this peer's next ball. */
  paint: Paint,
  session: Session,
  /** Whether this peer stepped out of a session while its page was hidden. */
  away: Schema.Boolean,
  relay: Schema.Option(Relay),
});
export type Model = typeof Model.Type;

export const camera = perspectiveCamera({ fov: 45, position: [0, 5, 8.5], lookAt: [0, 0.9, 0] });

/** A table with nothing thrown, no world yet, and no session. */
export const fresh: Model = {
  timeline: Timeline.make<Play>(0),
  balls: [],
  thrown: 0,
  build: 0,
  run: 0,
  reached: Option.none(),
  checksums: [],
  awaiting: [],
  agreed: 0,
  diverged: Option.none(),
  checksFrom: 0,
  paint: 'coral',
  session: { _tag: 'Offline' },
  away: false,
  relay: Option.none(),
};

export const init = () => ({
  model: fresh,
  // A name for this tab, then a session with any other tabletop tabs (or through a relay).
  commands: [NameTab()],
});
