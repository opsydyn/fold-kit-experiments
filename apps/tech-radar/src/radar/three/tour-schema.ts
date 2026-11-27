import { Schema } from 'effect';

import { Message } from './message';

/** A tour's starting deep link, its recorded moves, and optional captions. */
export const Recording = Schema.Struct({
  start: Schema.String,
  steps: Schema.Array(Message),
  captions: Schema.optionalKey(Schema.Array(Schema.String)),
});
export type Recording = typeof Recording.Type;

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
