import type { Document, HtmlBuilder } from 'foldkit/html';

import * as ScatterChart from '../../ui/scatter-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ScatterChart.Message): Message => Message.GotScatterMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Scatter Chart — foldkit-viz',
  body: ScatterChart.view(
    {
      model: model.scatter,
      toParentMessage,
      ariaLabel: 'Experience vs salary scatter plot',
    },
    h,
  ),
});
