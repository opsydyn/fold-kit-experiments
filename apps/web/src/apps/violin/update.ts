import type { Return as UpdateReturn } from 'foldkit/update';

import * as ViolinChart from '../../ui/violin-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotViolinMessage: ({ message }) => {
      const { model: chart } = ViolinChart.update(model.chart, message as ViolinChart.Message);
      return { model: { ...model, chart } };
    },
  });
