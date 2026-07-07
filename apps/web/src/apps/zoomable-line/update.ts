import { Match } from 'effect';
import * as ZoomableLineChart from '../../ui/zoomable-line-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotZoomableLineMessage: ({ message }) => {
        const [chart] = ZoomableLineChart.update(model.chart, message as ZoomableLineChart.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
