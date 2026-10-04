import type { Return as UpdateReturn } from 'foldkit/update';

import * as Choropleth from '../../ui/choropleth-map';
import type { ReceivedChoroplethMessage, Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return => {
  // SAFETY: The app model and message contracts establish this value before the assertion.
  const message = (msg as ReceivedChoroplethMessage).message;
  const { model: chart } = Choropleth.update(model.chart, message);
  return { model: { ...model, chart } };
};
