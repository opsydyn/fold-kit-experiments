import { Match } from 'effect';
import * as HistogramChart from '../../ui/histogram-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotHistogramMessage: ({ message }) => {
        const [chart] = HistogramChart.update(model.chart, message as HistogramChart.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
