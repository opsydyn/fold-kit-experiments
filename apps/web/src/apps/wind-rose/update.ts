import { Match } from 'effect';
import * as WR from '../../ui/wind-rose-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];
export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotWRMessage: ({ inner }) => {
        const [chart] = WR.update(model.chart, inner as WR.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
