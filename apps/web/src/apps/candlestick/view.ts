import type { Document } from 'foldkit/html';
import * as CandleChart from '../../ui/candlestick-chart';
import type { Message } from './message';
import { GotCandleMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: CandleChart.Message): Message => GotCandleMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Candlestick — foldkit-viz',
  body: CandleChart.view({
    model: model.candle,
    toParentMessage,
    ariaLabel: 'NVDA stock price candlestick chart',
  }),
});
