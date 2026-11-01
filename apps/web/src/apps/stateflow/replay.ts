/**
 * What the Model's events come to: the machine folded over them. Everything the page shows
 * of the session is read from here, so the scrubber only moves a number.
 */
import { Option } from 'effect';

import type { Model, TransitionFact } from './model';
import type { Frame, Specimen } from './specimen';
import { specimenOf } from './specimens';

export const specimenFor = (model: Model): Specimen => specimenOf(model.specimen);

// Replay is pure, so a recording's frames are kept for as long as the recording is.
const replayed = new WeakMap<ReadonlyArray<string>, Map<string, ReadonlyArray<Frame>>>();

/** Every event replayed, past the scrubber as well as before it. */
export const framesOf = (model: Model): ReadonlyArray<Frame> => {
  const bySpecimen = replayed.get(model.events) ?? new Map<string, ReadonlyArray<Frame>>();
  const frames = bySpecimen.get(model.specimen) ?? specimenFor(model).replay(model.events);
  bySpecimen.set(model.specimen, frames);
  replayed.set(model.events, bySpecimen);
  return frames;
};

/** The facts recorded up to the scrubber. */
export const traceOf = (model: Model): ReadonlyArray<TransitionFact> =>
  framesOf(model)
    .slice(0, model.cursor)
    .map(({ record }) => record);

/** The state the machine is in at the scrubber. */
export const stateTagOf = (model: Model): string =>
  Option.match(Option.fromNullishOr(framesOf(model)[model.cursor - 1]), {
    onNone: () => specimenFor(model).initialTag,
    onSome: ({ stateTag }) => stateTag,
  });

/** The fact recorded by the event at the scrubber, if one has been replayed. */
export const currentRecord = (model: Model): Option.Option<TransitionFact> =>
  Option.map(Option.fromNullishOr(framesOf(model)[model.cursor - 1]), ({ record }) => record);
