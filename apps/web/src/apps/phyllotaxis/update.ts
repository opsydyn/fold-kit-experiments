import { Match } from 'effect';
import * as PhyllotaxisChart from '../../ui/phyllotaxis-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotPhyllotaxisMessage: ({ inner }) => {
        const [chart] = PhyllotaxisChart.update(model.chart, inner as PhyllotaxisChart.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
