import { Match } from 'effect';

import * as BubbleChart from '../../ui/bubble-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotBubbleMessage: ({ message }) => {
        const [bubble] = BubbleChart.update(model.bubble, message as BubbleChart.Message);
        return [{ ...model, bubble }, []];
      },
    }),
  );
