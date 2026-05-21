import { Match } from 'effect';
import * as TreemapChart from '../../ui/treemap-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotTreemapMessage: ({ inner }) => {
        const [treemap] = TreemapChart.update(model.treemap, inner as TreemapChart.Message);
        return [{ ...model, treemap }, []];
      },
    }),
  );
