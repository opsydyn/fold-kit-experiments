/** Waiting for the pins to settle before counting them. */
import { Command } from '@effect/ui';
import { Duration, Effect, Schema } from 'effect';

import { Message } from './message';

/** After `seconds`, say that shot `shot` has had time to settle. */
export const SettleAfter = Command.make(
  'SettleAfter',
  { args: { shot: Schema.Number, seconds: Schema.Number } },
  ({ shot, seconds }) =>
    Effect.sleep(Duration.seconds(seconds)).pipe(Effect.map(() => Message.Settled({ shot }))),
);

/** Pins rest, and Rapier puts them to sleep, two seconds after they stop moving. */
export const RackRest = Command.make('RackRest', { args: { shot: Schema.Number } }, ({ shot }) =>
  Effect.sleep(Duration.seconds(2.5)).pipe(Effect.map(() => Message.RackRested({ shot }))),
);

/** The page's address fragment, where a replay link carries its record. */
export const ReadFragment = Command.make('ReadFragment', { args: {} }, () =>
  Effect.sync(() => Message.ReadFragment({ fragment: window.location.hash })),
);
