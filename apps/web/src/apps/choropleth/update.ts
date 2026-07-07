import * as Choropleth from '../../ui/choropleth-map';
import type { GotChoroplethMessage, Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return => {
  const message = (msg as GotChoroplethMessage).message;
  const [chart] = Choropleth.update(model.chart, message);
  return [{ ...model, chart }, []];
};
