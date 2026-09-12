import type { Return as UpdateReturn } from 'foldkit/update';

import * as ThresholdBar from '../../ui/threshold-bar-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotThresholdBarMessage: ({ message }) => {
      const { model: chart } = ThresholdBar.update(model.chart, message as ThresholdBar.Message);
      return { model: { ...model, chart } };
    },
  });
