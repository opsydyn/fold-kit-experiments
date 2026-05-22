import type { Document } from 'foldkit/html';
import * as HistogramChart from '../../ui/histogram-chart';
import type { Message } from './message';
import { GotHistogramMessage } from './message';
import type { Model } from './model';

type HistogramMessage = HistogramChart.Message;

const toParentMessage = (msg: HistogramMessage): Message => GotHistogramMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Salary Distribution — foldkit-viz',
  body: HistogramChart.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Employee salary distribution histogram',
  }),
});
