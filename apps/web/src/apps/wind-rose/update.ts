import type { Return as UpdateReturn } from 'foldkit/update';

import * as WR from '../../ui/wind-rose-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;
export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotWRMessage: ({ message }) => {
      const { model: chart } = WR.update(model.chart, message as WR.Message);
      return { model: { ...model, chart } };
    },
  });
