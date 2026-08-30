import type { Document, HtmlBuilder } from 'foldkit/html';

import * as ThresholdBar from '../../ui/threshold-bar-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ThresholdBar.Message): Message =>
  Message.GotThresholdBarMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'API response times — threshold bar — foldkit-viz',
  body: ThresholdBar.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'API endpoint response times with traffic-light threshold coloring',
    },
    h,
  ),
});
