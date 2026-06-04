import type { Document } from 'foldkit/html';

import * as BubbleChart from '../../ui/bubble-chart';
import type { Message } from './message';
import { GotBubbleMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: BubbleChart.Message): Message => GotBubbleMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Bubble Chart — foldkit-viz',
  body: BubbleChart.view({
    model: model.bubble,
    toParentMessage,
    ariaLabel: 'Product price vs rating bubble chart',
  }),
});
