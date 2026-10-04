import type { Return as UpdateReturn } from 'foldkit/update';

import * as DonutChart from '../../ui/donut-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    ReceivedDonutMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      const { model: nextDonut } = DonutChart.update(model.donut, message as DonutChart.Message);
      return { model: { ...model, donut: nextDonut } };
    },
  });
