import { Match } from 'effect';
import * as HistogramChart from '../../ui/histogram-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotHistogramMessage: ({ inner }) => {
        const [chart] = HistogramChart.update(model.chart, inner as HistogramChart.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
