import type { Return as UpdateReturn } from 'foldkit/update';

import * as LogScatter from '../../ui/log-scatter-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotLogScatterMessage: ({ message }) => {
      const { model: chart } = LogScatter.update(model.chart, message as LogScatter.Message);
      return { model: { ...model, chart } };
    },
  });
