import type { Return as UpdateReturn } from 'foldkit/update';

import * as ScatterChart from '../../ui/symbol-scatter-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotScatterMessage: ({ message }) => {
      const { model: chart } = ScatterChart.update(model.chart, message as ScatterChart.Message);
      return { model: { ...model, chart } };
    },
  });
