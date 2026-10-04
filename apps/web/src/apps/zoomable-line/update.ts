import type { Return as UpdateReturn } from 'foldkit/update';

import * as ZoomableLineChart from '../../ui/zoomable-line-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedZoomableLineMessage: ({ message }) => {
      const { model: chart } = ZoomableLineChart.update(
        model.chart,
        // SAFETY: The app model and message contracts establish this value before the assertion.
        message as ZoomableLineChart.Message,
      );
      return { model: { ...model, chart } };
    },
  });
