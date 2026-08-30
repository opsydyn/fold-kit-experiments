import type { Document, HtmlBuilder } from 'foldkit/html';

import * as DivBar from '../../ui/diverging-bar-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: DivBar.Message): Message => Message.GotDivBarMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Revenue growth — diverging bar — foldkit-viz',
  body: DivBar.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Monthly year-over-year revenue growth, diverging bar chart',
    },
    h,
  ),
});
