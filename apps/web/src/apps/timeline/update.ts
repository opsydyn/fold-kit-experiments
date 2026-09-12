import type { Return as UpdateReturn } from 'foldkit/update';

import * as TimelineChart from '../../ui/timeline-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotTimelineMessage: ({ message }) => {
      const { model: chart } = TimelineChart.update(model.chart, message as TimelineChart.Message);
      return { model: { ...model, chart } };
    },
  });
