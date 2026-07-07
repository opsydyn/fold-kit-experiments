import { Match } from 'effect';

import * as LineChart from '../../ui/line-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotLineMessage: ({ message }) => {
        const [line] = LineChart.update(model.line, message as LineChart.Message);
        return [{ ...model, line }, []];
      },
    }),
  );
