import type { Document } from 'foldkit/html';

import * as AreaChart from '../../ui/area-chart';
import type { Message } from './message';
import { GotAreaMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: AreaChart.Message): Message =>
  GotAreaMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Area Chart — foldkit-viz',
  body: AreaChart.view({
    model: model.area,
    toParentMessage,
    ariaLabel: 'Monthly revenue',
  }),
});
