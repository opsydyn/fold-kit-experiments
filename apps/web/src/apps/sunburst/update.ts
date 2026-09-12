import type { Return as UpdateReturn } from 'foldkit/update';

import * as SunburstChart from '../../ui/sunburst-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotSunburstMessage: ({ message }) => {
      const { model: sunburst } = SunburstChart.update(model.sunburst, message);
      return { model: { ...model, sunburst } };
    },
  });
