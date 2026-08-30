import type { Document, HtmlBuilder } from 'foldkit/html';

import * as BarChart from '../../ui/bar-chart';
import { Message } from './message';
import type { Model } from './model';

type BarMessage = BarChart.Message;

const toParentMessage = (msg: BarMessage): Message => Message.GotBarMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Bar Chart — foldkit-viz',
  body: h.div(
    [],
    [
      BarChart.view(
        {
          model: model.bar,
          toParentMessage,
          ariaLabel: 'Monthly figures',
        },
        h,
      ),
    ],
  ),
});
