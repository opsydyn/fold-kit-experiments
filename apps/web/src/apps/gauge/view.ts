import type { Document } from 'foldkit/html';

import * as GaugeChart from '../../ui/gauge-chart';
import type { Message } from './message';
import { GotGaugeMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: GaugeChart.Message): Message => GotGaugeMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Gauge — foldkit-viz',
  body: GaugeChart.view({
    model: model.gauge,
    toParentMessage,
    ariaLabel: 'System metrics gauge chart',
  }),
});
