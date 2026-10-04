import type { Return as UpdateReturn } from 'foldkit/update';

import * as WaterfallChart from '../../ui/waterfall-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedWaterfallMessage: ({ message }) => {
      const { model: waterfall } = WaterfallChart.update(
        model.waterfall,
        // SAFETY: The app model and message contracts establish this value before the assertion.
        message as WaterfallChart.Message,
      );
      return { model: { ...model, waterfall } };
    },
  });
