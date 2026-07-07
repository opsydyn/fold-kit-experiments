import type { Document } from 'foldkit/html';

import * as ScatterChart from '../../ui/symbol-scatter-chart';
import type { Message } from './message';
import { GotScatterMessage } from './message';
import type { Model } from './model';

type ScatterMessage = ScatterChart.Message;

const toParentMessage = (msg: ScatterMessage): Message => GotScatterMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'MPG vs Horsepower — foldkit-viz',
  body: ScatterChart.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Auto MPG vs horsepower scatter chart by origin',
  }),
});
