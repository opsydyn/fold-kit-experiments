import { perspectiveCamera, SceneSchema, Timeline } from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';

import { Paint } from '../palette';
import { NameTab } from './session';
import { Ball, Play, Relay, Session, Start } from './wire';

export { Ball } from './wire';

const Steps = Schema.Int;

/** The table at a step, before what was due there. */
export const Moment = Schema.Struct({
  step: Steps,
  balls: Schema.Array(Ball),
  thrown: Schema.Int,
  build: Schema.Int,
});
export type Moment = typeof Moment.Type;

export const Model = Schema.Struct({
  /** Every throw and rebuild, at the step it lands, and how far the world may go. */
  timeline: SceneSchema.Timeline(Play),
  /**
   * The world as the throws so far have made it: changed only when the world reaches
   * the step they land at, so it changes at the same step on every peer.
   */
  balls: Schema.Array(Ball),
  /**
   * Whether this peer predicts (`?predict=1`): its world runs to the turn it sends, not
   * the turn all have sent, so its own throws show at once, and it rolls back a few steps
   * when another peer's comes in for a step its world may have passed.
   */
  predict: Schema.Boolean,
  /** A predicting world's latest stops: the table at each, before what was due there. */
  history: Schema.Array(Moment),
  /** This peer's checksums at check steps not yet confirmed: shared once they are. */
  provisional: Schema.Array(Schema.Struct({ step: Steps, checksum: Schema.String })),
  /** How many times this peer's world has rolled back. */
  rollbacks: Schema.Int,
  /** The leader's latest snapshot of its world, to start a newcomer's from. */
  kept: Schema.Option(Start),
  /**
   * The snapshot this peer's run started from: one a welcome brought, or (`null`) the one
   * its world kept at a stop it rolled back to.
   */
  start: Schema.Option(Schema.Struct({ step: Steps, snapshot: Schema.NullOr(Schema.String) })),
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
  /**
   * A record being replayed (`#replay=…`): how far it runs, and how many checks it holds.
   * Its checks wait in `awaiting`, compared as the world reaches them.
   */
  replay: Schema.Option(Schema.Struct({ until: Steps, checks: Schema.Int })),
  relay: Schema.Option(Relay),
});
export type Model = typeof Model.Type;

export const camera = perspectiveCamera({ fov: 45, position: [0, 5, 8.5], lookAt: [0, 0.9, 0] });

/** A table with nothing thrown, no world yet, and no session. */
export const fresh: Model = {
  timeline: Timeline.make<Play>(0),
  balls: [],
  predict: false,
  history: [],
  provisional: [],
  rollbacks: 0,
  kept: Option.none(),
  start: Option.none(),
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
  replay: Option.none(),
  relay: Option.none(),
};

export const init = () => ({
  model: fresh,
  // A name for this tab, then a session with any other tabletop tabs (or through a relay).
  commands: [NameTab()],
});
