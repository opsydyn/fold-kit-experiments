import type { Document, HtmlBuilder } from 'foldkit/html';

import * as HistogramChart from '../../ui/histogram-chart';
import { Message } from './message';
import type { Model } from './model';

type HistogramMessage = HistogramChart.Message;

const toParentMessage = (msg: HistogramMessage): Message => Message.GotHistogramMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Salary Distribution — foldkit-viz',
  body: HistogramChart.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Employee salary distribution histogram',
    },
    h,
  ),
});
