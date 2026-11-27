import { Schema } from 'effect';

import { Message } from './message';

/** A recording: where it began, as a deep link, and the moves made from there. */
export const Recording = Schema.Struct({ start: Schema.String, steps: Schema.Array(Message) });
export type Recording = typeof Recording.Type;

/** The recorder state and the current playback position. */
export const Tour = Schema.TaggedUnion({
  Idle: {},
  Recording: { recording: Recording },
  Ready: { recording: Recording },
  Playing: {
    recording: Recording,
    next: Schema.Number,
    wait: Schema.Number,
    caption: Schema.String,
  },
});
export type Tour = typeof Tour.Type;
