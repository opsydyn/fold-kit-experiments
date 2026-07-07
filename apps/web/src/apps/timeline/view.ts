import type { Document } from 'foldkit/html';

import * as TimelineChart from '../../ui/timeline-chart';
import type { Message } from './message';
import { GotTimelineMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: TimelineChart.Message): Message =>
  GotTimelineMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Project timeline — foldkit-viz',
  body: TimelineChart.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Product launch project timeline',
  }),
});
