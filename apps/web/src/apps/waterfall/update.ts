import { Match } from 'effect';
import * as WaterfallChart from '../../ui/waterfall-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotWaterfallMessage: ({ inner }) => {
        const [waterfall] = WaterfallChart.update(model.waterfall, inner as WaterfallChart.Message);
        return [{ ...model, waterfall }, []];
      },
    }),
  );
