import type { Document, HtmlBuilder } from 'foldkit/html';

import * as BubbleChart from '../../ui/bubble-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: BubbleChart.Message): Message => Message.GotBubbleMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Bubble Chart — foldkit-viz',
  body: BubbleChart.view(
    {
      model: model.bubble,
      toParentMessage,
      ariaLabel: 'Product price vs rating bubble chart',
    },
    h,
  ),
});
