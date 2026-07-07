import { Match } from 'effect';
import * as TidyTree from '../../ui/tidy-tree-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotTreeMessage: ({ message }) => {
        const [chart] = TidyTree.update(model.chart, message as TidyTree.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
