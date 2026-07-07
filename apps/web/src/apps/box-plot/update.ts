import { Match } from 'effect';
import * as BoxChart from '../../ui/box-plot-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotBoxMessage: ({ message }) => {
        const [box] = BoxChart.update(model.box, message as BoxChart.Message);
        return [{ ...model, box }, []];
      },
    }),
  );
