import { Match } from 'effect';
import * as CandleChart from '../../ui/candlestick-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotCandleMessage: ({ inner }) => {
        const [candle] = CandleChart.update(model.candle, inner as CandleChart.Message);
        return [{ ...model, candle }, []];
      },
    }),
  );
