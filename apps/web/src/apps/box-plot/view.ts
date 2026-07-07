import type { Document } from 'foldkit/html';

import * as BoxChart from '../../ui/box-plot-chart';
import type { Message } from './message';
import { GotBoxMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: BoxChart.Message): Message => GotBoxMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Box Plot — foldkit-viz',
  body: BoxChart.view({
    model: model.box,
    toParentMessage,
    ariaLabel: 'Salary distribution by engineering level box plot',
  }),
});
