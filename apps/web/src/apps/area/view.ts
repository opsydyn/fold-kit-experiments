import type { Document, HtmlBuilder } from 'foldkit/html';

import * as AreaChart from '../../ui/area-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: AreaChart.Message): Message => Message.GotAreaMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Area Chart — foldkit-viz',
  body: AreaChart.view(
    {
      model: model.area,
      toParentMessage,
      ariaLabel: 'Monthly revenue',
    },
    h,
  ),
});
