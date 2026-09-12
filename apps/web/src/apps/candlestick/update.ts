import type { Return as UpdateReturn } from 'foldkit/update';

import * as CandleChart from '../../ui/candlestick-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotCandleMessage: ({ message }) => {
      const { model: candle } = CandleChart.update(model.candle, message as CandleChart.Message);
      return { model: { ...model, candle } };
    },
  });
