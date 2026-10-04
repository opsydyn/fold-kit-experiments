import type { Return as UpdateReturn } from 'foldkit/update';

import * as HeatmapChart from '../../ui/heatmap-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedHeatmapMessage: ({ message }) => {
      const { model: heatmap } = HeatmapChart.update(
        model.heatmap,
        // SAFETY: The app model and message contracts establish this value before the assertion.
        message as HeatmapChart.Message,
      );
      return { model: { ...model, heatmap } };
    },
  });
