import type { Document } from 'foldkit/html';

import * as RadarChart from '../../ui/radar-chart';
import type { Message } from './message';
import { GotRadarMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: RadarChart.Message): Message => GotRadarMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Radar Chart — foldkit-viz',
  body: RadarChart.view({
    model: model.radar,
    toParentMessage,
    ariaLabel: 'Language comparison radar chart',
  }),
});
