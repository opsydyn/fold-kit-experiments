import type { Return as UpdateReturn } from 'foldkit/update';

import * as PhyllotaxisChart from '../../ui/phyllotaxis-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotPhyllotaxisMessage: ({ message }) => {
      const { model: chart } = PhyllotaxisChart.update(
        model.chart,
        message as PhyllotaxisChart.Message,
      );
      return { model: { ...model, chart } };
    },
  });
