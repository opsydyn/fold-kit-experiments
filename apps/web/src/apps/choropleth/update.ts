import type { Return as UpdateReturn } from 'foldkit/update';

import * as Choropleth from '../../ui/choropleth-map';
import type { GotChoroplethMessage, Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return => {
  const message = (msg as GotChoroplethMessage).message;
  const { model: chart } = Choropleth.update(model.chart, message);
  return { model: { ...model, chart } };
};
