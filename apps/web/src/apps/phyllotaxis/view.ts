import type { Document, HtmlBuilder } from 'foldkit/html';

import * as PhyllotaxisChart from '../../ui/phyllotaxis-chart';
import { Message } from './message';
import type { Model } from './model';

type PhyllotaxisMessage = PhyllotaxisChart.Message;

const toParentMessage = (msg: PhyllotaxisMessage): Message =>
  Message.GotPhyllotaxisMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Phyllotaxis — foldkit-viz',
  body: PhyllotaxisChart.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Phyllotaxis zoom and pan',
    },
    h,
  ),
});
