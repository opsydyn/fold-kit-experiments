import { Match } from 'effect';
import * as Bump from '../../ui/bump-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotBumpMessage: ({ message }) => {
        const [chart] = Bump.update(model.chart, message as Bump.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
