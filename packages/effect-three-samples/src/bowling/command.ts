/** Waiting for the pins to settle before counting them. */
import { Duration, Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { Message } from './message';

/** After `seconds`, say that shot `shot` has had time to settle. */
export const SettleAfter = Command.define('SettleAfter', {
  args: { shot: Schema.Number, seconds: Schema.Number },
  messages: [Message.Settled],
  execute: ({ shot, seconds }) =>
    Effect.sleep(Duration.seconds(seconds)).pipe(Effect.map(() => Message.Settled({ shot }))),
});

/** Pins rest, and Rapier puts them to sleep, two seconds after they stop moving. */
export const RackRest = Command.define('RackRest', {
  args: { shot: Schema.Number },
  messages: [Message.RackRested],
  execute: ({ shot }) =>
    Effect.sleep(Duration.seconds(2.5)).pipe(Effect.map(() => Message.RackRested({ shot }))),
});

/** The page's address fragment, where a replay link carries its record. */
export const ReadFragment = Command.define('ReadFragment', {
  messages: [Message.ReadFragment],
  execute: Effect.sync(() => Message.ReadFragment({ fragment: window.location.hash })),
});
