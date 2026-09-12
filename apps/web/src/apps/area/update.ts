import type { Return as UpdateReturn } from 'foldkit/update';

import * as AreaChart from '../../ui/area-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotAreaMessage: ({ message }) => {
      const { model: area } = AreaChart.update(model.area, message as AreaChart.Message);
      return { model: { ...model, area } };
    },
  });
