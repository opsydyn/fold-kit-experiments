import type { Document } from 'foldkit/html';

import * as LineChart from '../../ui/line-chart';
import type { Message } from './message';
import { GotLineMessage } from './message';
import type { Model } from './model';

type LineMessage = LineChart.Message;

const toParentMessage = (msg: LineMessage): Message => GotLineMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Line Chart — foldkit-viz',
  body: LineChart.view({
    model: model.line,
    toParentMessage,
    ariaLabel: 'Monthly figures',
  }),
});
