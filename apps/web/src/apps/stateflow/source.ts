import { Option, Schema } from 'effect';

import type { Model } from './model';
import { TransitionRecorded } from './ports';
export const encodeEvent = Schema.encodeSync(
  Schema.fromJsonString(TransitionRecorded, { space: 2 }),
);
export const selectedEventSource = (model: Model): string =>
  Option.fromNullishOr(
    model.trace.find((record) => record.sequence === model.selectedSequence),
  ).pipe(
    Option.map(encodeEvent),
    Option.getOrElse(() => ''),
  );
