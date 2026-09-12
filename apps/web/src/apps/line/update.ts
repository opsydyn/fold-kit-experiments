import type { Return as UpdateReturn } from 'foldkit/update';

import * as LineChart from '../../ui/line-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotLineMessage: ({ message }) => {
      const { model: line } = LineChart.update(model.line, message as LineChart.Message);
      return { model: { ...model, line } };
    },
  });
