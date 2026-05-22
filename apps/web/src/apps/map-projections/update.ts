import { Match } from 'effect';
import * as MapProjections from '../../ui/map-projections-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotMapMessage: ({ inner }) => {
        const [chart] = MapProjections.update(model.chart, inner as MapProjections.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
