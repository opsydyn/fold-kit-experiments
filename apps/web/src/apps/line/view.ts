import type { Document, HtmlBuilder } from 'foldkit/html';

import * as LineChart from '../../ui/line-chart';
import { Message } from './message';
import type { Model } from './model';

type LineMessage = LineChart.Message;

const toParentMessage = (msg: LineMessage): Message => Message.GotLineMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Line Chart — foldkit-viz',
  body: LineChart.view(
    {
      model: model.line,
      toParentMessage,
      ariaLabel: 'Monthly figures',
    },
    h,
  ),
});
