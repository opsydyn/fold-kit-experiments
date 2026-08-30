import type { Document, HtmlBuilder } from 'foldkit/html';

import * as CandleChart from '../../ui/candlestick-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: CandleChart.Message): Message => Message.GotCandleMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Candlestick — foldkit-viz',
  body: CandleChart.view(
    {
      model: model.candle,
      toParentMessage,
      ariaLabel: 'NVDA stock price candlestick chart',
    },
    h,
  ),
});
