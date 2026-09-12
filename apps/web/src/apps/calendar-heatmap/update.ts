import type { Return as UpdateReturn } from 'foldkit/update';

import * as CalendarHeatmapChart from '../../ui/calendar-heatmap-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    GotCalendarMessage: ({ message }) => {
      const { model: calendar } = CalendarHeatmapChart.update(
        model.calendar,
        message as CalendarHeatmapChart.Message,
      );
      return { model: { ...model, calendar } };
    },
  });
