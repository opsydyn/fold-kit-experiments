import type { Document, HtmlBuilder } from 'foldkit/html';

import * as WR from '../../ui/wind-rose-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: WR.Message): Message => Message.GotWRMessage({ message: msg });
export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Wind rose — foldkit-viz',
  body: WR.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Wind rose — directional frequency',
    },
    h,
  ),
});
