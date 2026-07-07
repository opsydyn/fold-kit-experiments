import type { Document } from 'foldkit/html';
import * as SunburstChart from '../../ui/sunburst-chart';
import type { Message } from './message';
import { GotSunburstMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: SunburstChart.Message): Message => GotSunburstMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Sunburst — foldkit-viz',
  body: SunburstChart.view({
    model: model.sunburst,
    toParentMessage,
    ariaLabel: 'Tech market cap by sector sunburst chart',
  }),
});
