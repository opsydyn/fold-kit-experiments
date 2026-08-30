import type { Document, HtmlBuilder } from 'foldkit/html';

import * as TimelineChart from '../../ui/timeline-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: TimelineChart.Message): Message =>
  Message.GotTimelineMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Project timeline — foldkit-viz',
  body: TimelineChart.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Product launch project timeline',
    },
    h,
  ),
});
