import type { Document } from 'foldkit/html';

import * as ViolinChart from '../../ui/violin-chart';
import type { Message } from './message';
import { GotViolinMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ViolinChart.Message): Message => GotViolinMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Salary distribution by level — foldkit-viz',
  body: ViolinChart.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Salary distribution by engineering level violin plot',
  }),
});
