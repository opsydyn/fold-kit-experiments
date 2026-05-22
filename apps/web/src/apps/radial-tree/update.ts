import { Match } from 'effect';
import * as RadialTree from '../../ui/radial-tree-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotRadialMessage: ({ inner }) => {
        const [chart] = RadialTree.update(model.chart, inner as RadialTree.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
