import { Match } from 'effect';
import * as RadialTree from '../../ui/radial-tree-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotRadialMessage: ({ message }) => {
        const [chart] = RadialTree.update(model.chart, message as RadialTree.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
