import { Match } from 'effect';

import * as LogScatter from '../../ui/log-scatter-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotLogScatterMessage: ({ message }) => {
        const [chart] = LogScatter.update(model.chart, message as LogScatter.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
