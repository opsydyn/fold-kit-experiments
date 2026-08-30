import type { Document, HtmlBuilder } from 'foldkit/html';

import * as SunburstChart from '../../ui/sunburst-chart';
import { Message } from './message';
import type { Model } from './model';

const toParentMessage = (msg: SunburstChart.Message): Message =>
  Message.GotSunburstMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Sunburst — foldkit-viz',
  body: SunburstChart.view(
    {
      model: model.sunburst,
      toParentMessage,
      ariaLabel: 'Tech market cap by sector sunburst chart',
    },
    h,
  ),
});
