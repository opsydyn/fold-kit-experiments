import type { Return as UpdateReturn } from 'foldkit/update';

import * as GaugeChart from '../../ui/gauge-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotGaugeMessage: ({ message }) => {
      const { model: gauge } = GaugeChart.update(model.gauge, message as GaugeChart.Message);
      return { model: { ...model, gauge } };
    },
  });
