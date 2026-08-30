import type { Document, HtmlBuilder } from 'foldkit/html';

import * as GaugeChart from '../../ui/gauge-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: GaugeChart.Message): Message => Message.GotGaugeMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Gauge — foldkit-viz',
  body: GaugeChart.view(
    {
      model: model.gauge,
      toParentMessage,
      ariaLabel: 'System metrics gauge chart',
    },
    h,
  ),
});
