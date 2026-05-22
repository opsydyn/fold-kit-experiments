import { Match } from 'effect';
import * as PackedChart from '../../ui/packed-circles-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotPackedMessage: ({ inner }) => {
        const [packed] = PackedChart.update(model.packed, inner as PackedChart.Message);
        return [{ ...model, packed }, []];
      },
    }),
  );
