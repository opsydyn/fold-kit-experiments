import type { Document } from 'foldkit/html';

import * as ScatterChart from '../../ui/scatter-chart';
import type { Message } from './message';
import { GotScatterMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ScatterChart.Message): Message => GotScatterMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Scatter Chart — foldkit-viz',
  body: ScatterChart.view({
    model: model.scatter,
    toParentMessage,
    ariaLabel: 'Experience vs salary scatter plot',
  }),
});
