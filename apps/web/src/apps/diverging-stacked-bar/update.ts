import { Match } from 'effect';
import * as DSB from '../../ui/diverging-stacked-bar';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];
export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotDSBMessage: ({ inner }) => {
        const [chart] = DSB.update(model.chart, inner as DSB.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
