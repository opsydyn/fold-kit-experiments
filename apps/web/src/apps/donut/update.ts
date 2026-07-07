import { Match } from 'effect';

import * as DonutChart from '../../ui/donut-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotDonutMessage: ({ message }) => {
        const [nextDonut] = DonutChart.update(model.donut, message as DonutChart.Message);
        return [{ ...model, donut: nextDonut }, []];
      },
    }),
  );
