import * as Choropleth from '../../ui/choropleth-map';
import type { GotChoroplethMessage, Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return => {
  const inner = (msg as GotChoroplethMessage).inner;
  const [chart] = Choropleth.update(model.chart, inner);
  return [{ ...model, chart }, []];
};
