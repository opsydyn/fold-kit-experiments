import type { Document, HtmlBuilder } from 'foldkit/html';

import * as ScatterChart from '../../ui/symbol-scatter-chart';
import { Message } from './message';
import type { Model } from './model';

type ScatterMessage = ScatterChart.Message;

const toParentMessage = (msg: ScatterMessage): Message => Message.GotScatterMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'MPG vs Horsepower — foldkit-viz',
  body: ScatterChart.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Auto MPG vs horsepower scatter chart by origin',
    },
    h,
  ),
});
