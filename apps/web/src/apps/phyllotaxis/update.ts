import type { Return as UpdateReturn } from 'foldkit/update';

import * as PhyllotaxisChart from '../../ui/phyllotaxis-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedPhyllotaxisMessage: ({ message }) => {
      const { model: chart } = PhyllotaxisChart.update(
        model.chart,
        // SAFETY: The app model and message contracts establish this value before the assertion.
        message as PhyllotaxisChart.Message,
      );
      return { model: { ...model, chart } };
    },
  });
