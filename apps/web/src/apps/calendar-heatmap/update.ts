import type { Return as UpdateReturn } from 'foldkit/update';

import * as CalendarHeatmapChart from '../../ui/calendar-heatmap-chart';
import { Message } from './message';
import type { Model } from './model';

type Return = UpdateReturn<Model, Message>;

export const update = (model: Model, msg: Message): Return =>
  Message.match(msg, {
    ReceivedCalendarMessage: ({ message }) => {
      const { model: calendar } = CalendarHeatmapChart.update(
        model.calendar,
        // SAFETY: The app model and message contracts establish this value before the assertion.
        message as CalendarHeatmapChart.Message,
      );
      return { model: { ...model, calendar } };
    },
  });
