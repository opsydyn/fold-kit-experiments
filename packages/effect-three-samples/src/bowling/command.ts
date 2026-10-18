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
