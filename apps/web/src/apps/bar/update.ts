import type { Return as UpdateReturn } from 'foldkit/update';

import * as BarChart from '../../ui/bar-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    GotBarMessage: ({ message }) => {
      const { model: nextBar } = BarChart.update(model.bar, message as BarChart.Message);
      return { model: { ...model, bar: nextBar } };
    },
  });
