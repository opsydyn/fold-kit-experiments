import type { Document, HtmlBuilder } from 'foldkit/html';

import * as PackedChart from '../../ui/packed-circles-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: PackedChart.Message): Message => Message.GotPackedMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Packed Circles — foldkit-viz',
  body: PackedChart.view(
    {
      model: model.packed,
      toParentMessage,
      ariaLabel: 'Programming language families packed circle chart',
    },
    h,
  ),
});
