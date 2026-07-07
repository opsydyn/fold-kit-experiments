import type { Document } from 'foldkit/html';

import * as WaterfallChart from '../../ui/waterfall-chart';
import type { Message } from './message';
import { GotWaterfallMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: WaterfallChart.Message): Message =>
  GotWaterfallMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Waterfall — foldkit-viz',
  body: WaterfallChart.view({
    model: model.waterfall,
    toParentMessage,
    ariaLabel: 'Annual P&L waterfall chart',
  }),
});
