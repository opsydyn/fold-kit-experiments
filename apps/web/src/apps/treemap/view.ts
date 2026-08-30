import type { Document, HtmlBuilder } from 'foldkit/html';

import * as TreemapChart from '../../ui/treemap-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: TreemapChart.Message): Message => Message.GotTreemapMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Treemap — foldkit-viz',
  body: TreemapChart.view(
    {
      model: model.treemap,
      toParentMessage,
      ariaLabel: 'Tech revenue treemap by segment',
    },
    h,
  ),
});
