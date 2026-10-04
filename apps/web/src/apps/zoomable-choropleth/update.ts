import type { Return as UpdateReturn } from 'foldkit/update';

import * as ZChoropleth from '../../ui/zoomable-choropleth-map';
import type { ReceivedZChoroplethMessage, Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return => {
  // SAFETY: The app model and message contracts establish this value before the assertion.
  const message = (msg as ReceivedZChoroplethMessage).message;
  const { model: chart } = ZChoropleth.update(model.chart, message);
  return { model: { ...model, chart } };
};
