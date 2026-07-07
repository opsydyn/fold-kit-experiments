import { Match } from 'effect';
import * as ScatterChart from '../../ui/symbol-scatter-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotScatterMessage: ({ message }) => {
        const [chart] = ScatterChart.update(model.chart, message as ScatterChart.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
