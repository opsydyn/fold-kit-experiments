import { Match } from 'effect';
import * as Voronoi from '../../ui/voronoi-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotVoronoiMessage: ({ message }) => {
        const [chart] = Voronoi.update(model.chart, message as Voronoi.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
