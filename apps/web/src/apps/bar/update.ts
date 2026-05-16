import { Match } from 'effect';
import * as BarChart from '../../ui/bar-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotBarMessage: ({ inner }) => {
        const [nextBar] = BarChart.update(model.bar, inner as BarChart.Message);
        return [{ ...model, bar: nextBar }, []];
      },
    }),
  );
