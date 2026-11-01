import { Option, Schema } from 'effect';

import type { Model } from './model';
import { TransitionRecorded } from './ports';
import { framesOf } from './replay';

export const encodeEvent = Schema.encodeSync(
  Schema.fromJsonString(TransitionRecorded, { space: 2 }),
);
export const selectedEventSource = (model: Model): string =>
  Option.fromNullishOr(
    framesOf(model).find(({ record }) => record.sequence === model.selectedSequence),
  ).pipe(
    Option.map(({ record }) => encodeEvent(record)),
    Option.getOrElse(() => ''),
  );
