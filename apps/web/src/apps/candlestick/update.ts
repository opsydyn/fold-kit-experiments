import type { Return as UpdateReturn } from 'foldkit/update';

import * as CandleChart from '../../ui/candlestick-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedCandleMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      const { model: candle } = CandleChart.update(model.candle, message as CandleChart.Message);
      return { model: { ...model, candle } };
    },
  });
