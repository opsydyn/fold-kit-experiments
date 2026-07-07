import { Match } from 'effect';
import * as EasingCurves from '../../ui/easing-curves-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotEasingMessage: ({ message }) => {
        const [chart] = EasingCurves.update(model.chart, message as EasingCurves.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
