import type { Return as UpdateReturn } from 'foldkit/update';

import * as ZChoropleth from '../../ui/zoomable-choropleth-map';
import type { GotZChoroplethMessage, Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return => {
  const message = (msg as GotZChoroplethMessage).message;
  const { model: chart } = ZChoropleth.update(model.chart, message);
  return { model: { ...model, chart } };
};
