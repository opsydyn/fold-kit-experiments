import type { Return as UpdateReturn } from 'foldkit/update';

import * as ZoomableLineChart from '../../ui/zoomable-line-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotZoomableLineMessage: ({ message }) => {
      const { model: chart } = ZoomableLineChart.update(
        model.chart,
        message as ZoomableLineChart.Message,
      );
      return { model: { ...model, chart } };
    },
  });
