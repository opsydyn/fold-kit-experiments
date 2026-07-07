import { Match } from 'effect';

import * as Arc from '../../ui/arc-diagram';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotArcMessage: ({ message }) => {
        const [chart] = Arc.update(model.chart, message as Arc.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
