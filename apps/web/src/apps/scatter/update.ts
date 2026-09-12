import type { Return as UpdateReturn } from 'foldkit/update';

import * as ScatterChart from '../../ui/scatter-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotScatterMessage: ({ message }) => {
      const { model: scatter } = ScatterChart.update(
        model.scatter,
        message as ScatterChart.Message,
      );
      return { model: { ...model, scatter } };
    },
  });
