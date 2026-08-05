import type { Document, HtmlBuilder } from 'foldkit/html';

import * as Choropleth from '../../ui/choropleth-map';
import type { Message } from './message';
import { GotChoroplethMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: Choropleth.Message): Message =>
  GotChoroplethMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'World internet penetration — choropleth map',
  body: Choropleth.view(
    {
      model: model.chart,
      toParentMessage,
      ariaLabel: 'Choropleth map showing world internet penetration percentage by country',
    },
    h,
  ),
});
