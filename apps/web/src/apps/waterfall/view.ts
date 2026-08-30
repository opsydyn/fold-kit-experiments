import type { Document, HtmlBuilder } from 'foldkit/html';

import * as WaterfallChart from '../../ui/waterfall-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: WaterfallChart.Message): Message =>
  Message.GotWaterfallMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Waterfall — foldkit-viz',
  body: WaterfallChart.view(
    {
      model: model.waterfall,
      toParentMessage,
      ariaLabel: 'Annual P&L waterfall chart',
    },
    h,
  ),
});
