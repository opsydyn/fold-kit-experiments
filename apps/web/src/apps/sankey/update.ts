import { Match } from 'effect';
import * as SankeyChart from '../../ui/sankey-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotSankeyMessage: ({ message }) => {
        const [sankey] = SankeyChart.update(model.sankey, message as SankeyChart.Message);
        return [{ ...model, sankey }, []];
      },
    }),
  );
