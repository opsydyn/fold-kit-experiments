import type { Document, HtmlBuilder } from 'foldkit/html';

import * as HeatmapChart from '../../ui/heatmap-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: HeatmapChart.Message): Message => Message.GotHeatmapMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Heatmap — foldkit-viz',
  body: HeatmapChart.view(
    {
      model: model.heatmap,
      toParentMessage,
      ariaLabel: 'Website traffic by day and hour',
    },
    h,
  ),
});
