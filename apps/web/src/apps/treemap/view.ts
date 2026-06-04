import type { Document } from 'foldkit/html';
import * as TreemapChart from '../../ui/treemap-chart';
import type { Message } from './message';
import { GotTreemapMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: TreemapChart.Message): Message => GotTreemapMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Treemap — foldkit-viz',
  body: TreemapChart.view({
    model: model.treemap,
    toParentMessage,
    ariaLabel: 'Tech revenue treemap by segment',
  }),
});
