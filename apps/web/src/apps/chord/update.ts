import { Match } from 'effect';

import * as ChordChart from '../../ui/chord-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotChordMessage: ({ message }) => {
        const [chord] = ChordChart.update(model.chord, message as ChordChart.Message);
        return [{ ...model, chord }, []];
      },
    }),
  );
