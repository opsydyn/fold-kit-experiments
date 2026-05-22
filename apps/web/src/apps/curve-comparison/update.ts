import { Match } from 'effect';
import * as CurveComparison from '../../ui/curve-comparison-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotCurveMessage: ({ inner }) => {
        const [chart] = CurveComparison.update(model.chart, inner as CurveComparison.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
