import { Match } from 'effect';

import * as DivBar from '../../ui/diverging-bar-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotDivBarMessage: ({ message }) => {
        const [chart] = DivBar.update(model.chart, message as DivBar.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
