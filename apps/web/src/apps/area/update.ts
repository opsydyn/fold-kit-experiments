import { Match } from 'effect';
import * as AreaChart from '../../ui/area-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotAreaMessage: ({ message }) => {
        const [area] = AreaChart.update(model.area, message as AreaChart.Message);
        return [{ ...model, area }, []];
      },
    }),
  );
