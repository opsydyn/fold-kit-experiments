import { Match } from 'effect';

import * as ScatterChart from '../../ui/scatter-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotScatterMessage: ({ message }) => {
        const [scatter] = ScatterChart.update(model.scatter, message as ScatterChart.Message);
        return [{ ...model, scatter }, []];
      },
    }),
  );
