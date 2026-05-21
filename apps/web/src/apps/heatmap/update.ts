import { Match } from 'effect';
import * as HeatmapChart from '../../ui/heatmap-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotHeatmapMessage: ({ inner }) => {
        const [heatmap] = HeatmapChart.update(model.heatmap, inner as HeatmapChart.Message);
        return [{ ...model, heatmap }, []];
      },
    }),
  );
