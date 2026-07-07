import type { Document } from 'foldkit/html';

import * as HeatmapChart from '../../ui/heatmap-chart';
import type { Message } from './message';
import { GotHeatmapMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: HeatmapChart.Message): Message => GotHeatmapMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Heatmap — foldkit-viz',
  body: HeatmapChart.view({
    model: model.heatmap,
    toParentMessage,
    ariaLabel: 'Website traffic by day and hour',
  }),
});
