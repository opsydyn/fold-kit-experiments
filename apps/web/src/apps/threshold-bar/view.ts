import type { Document } from 'foldkit/html';

import * as ThresholdBar from '../../ui/threshold-bar-chart';
import type { Message } from './message';
import { GotThresholdBarMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ThresholdBar.Message): Message =>
  GotThresholdBarMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'API response times — threshold bar — foldkit-viz',
  body: ThresholdBar.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'API endpoint response times with traffic-light threshold coloring',
  }),
});
