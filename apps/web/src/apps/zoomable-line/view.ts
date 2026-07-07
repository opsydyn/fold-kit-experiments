import type { Document } from 'foldkit/html';

import * as ZoomableLineChart from '../../ui/zoomable-line-chart';
import type { Message } from './message';
import { GotZoomableLineMessage } from './message';
import type { Model } from './model';

type ZoomableLineMessage = ZoomableLineChart.Message;

const toParentMessage = (msg: ZoomableLineMessage): Message =>
  GotZoomableLineMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Zoomable Line Chart — foldkit-viz',
  body: ZoomableLineChart.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Stock price — zoom and pan',
  }),
});
