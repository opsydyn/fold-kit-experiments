import { Match } from 'effect';

import * as ViolinChart from '../../ui/violin-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotViolinMessage: ({ message }) => {
        const [chart] = ViolinChart.update(model.chart, message as ViolinChart.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
