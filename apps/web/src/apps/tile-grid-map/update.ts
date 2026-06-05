import { Match } from 'effect';
import * as TG from '../../ui/tile-grid-map';
import type { Message } from './message';
import type { Model } from './model';
type Return = readonly [Model, readonly []];
export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotTGMessage: ({ inner }) => {
        const [chart] = TG.update(model.chart, inner as TG.Message);
        return [{ ...model, chart }, []];
      },
    }),
  );
