import type { Document, HtmlBuilder } from 'foldkit/html';

import * as BoxChart from '../../ui/box-plot-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: BoxChart.Message): Message => Message.GotBoxMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Box Plot — foldkit-viz',
  body: BoxChart.view(
    {
      model: model.box,
      toParentMessage,
      ariaLabel: 'Salary distribution by engineering level box plot',
    },
    h,
  ),
});
