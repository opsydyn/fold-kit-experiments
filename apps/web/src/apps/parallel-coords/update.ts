import { Match } from 'effect';

import * as ParallelCoordsChart from '../../ui/parallel-coords-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotParallelCoordsMessage: ({ message }) => {
        const [parallelCoords] = ParallelCoordsChart.update(
          model.parallelCoords,
          message as ParallelCoordsChart.Message,
        );
        return [{ ...model, parallelCoords }, []];
      },
    }),
  );
