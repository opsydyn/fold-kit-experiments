import { Match } from 'effect';
import * as TimelineChart from '../../ui/timeline-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotTimelineMessage: ({ inner }) => {
        const [chart] = TimelineChart.update(model.chart, inner as TimelineChart.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
