import type { Return as UpdateReturn } from 'foldkit/update';

import * as BoxChart from '../../ui/box-plot-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotBoxMessage: ({ message }) => {
      const { model: box } = BoxChart.update(model.box, message as BoxChart.Message);
      return { model: { ...model, box } };
    },
  });
