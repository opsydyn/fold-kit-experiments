import type { Return as UpdateReturn } from 'foldkit/update';

import * as RadarChart from '../../ui/radar-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedRadarMessage: ({ message }) => {
      // SAFETY: The app model and message contracts establish this value before the assertion.
      const { model: radar } = RadarChart.update(model.radar, message as RadarChart.Message);
      return { model: { ...model, radar } };
    },
  });
