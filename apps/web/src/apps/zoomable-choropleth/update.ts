import * as ZChoropleth from '../../ui/zoomable-choropleth-map';
import type { GotZChoroplethMessage, Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return => {
  const message = (msg as GotZChoroplethMessage).message;
  const [chart] = ZChoropleth.update(model.chart, message);
  return [{ ...model, chart }, []];
};
