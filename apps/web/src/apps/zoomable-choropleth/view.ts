import type { Document } from 'foldkit/html';
import * as ZChoropleth from '../../ui/zoomable-choropleth-map';
import type { Message } from './message';
import { GotZChoroplethMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ZChoropleth.Message): Message =>
  GotZChoroplethMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'World internet penetration — zoomable choropleth map',
  body: ZChoropleth.view({
    model: model.chart,
    toParentMessage,
    ariaLabel: 'Zoomable choropleth map showing world internet penetration percentage by country',
  }),
});
