import { Match } from 'effect';
import * as DensityContour from '../../ui/density-contour-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotDensityContourMessage: ({ inner }) => {
        const [chart] = DensityContour.update(model.chart, inner as DensityContour.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
