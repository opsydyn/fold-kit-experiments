import { Match } from 'effect';
import * as Corr from '../../ui/correlation-matrix';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];
export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotCorrMessage: ({ message }) => {
        const [chart] = Corr.update(model.chart, message as Corr.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
