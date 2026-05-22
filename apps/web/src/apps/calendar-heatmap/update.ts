import { Match } from 'effect';
import * as CalendarHeatmapChart from '../../ui/calendar-heatmap-chart';
import type { Message } from './message';
import type { Model } from './model';

type Return = readonly [Model, readonly []];

export const update = (model: Model, msg: Message): Return =>
  Match.value(msg).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotCalendarMessage: ({ inner }) => {
        const [calendar] = CalendarHeatmapChart.update(
          model.calendar,
          inner as CalendarHeatmapChart.Message,
        );
        return [{ ...model, calendar }, []];
      },
    }),
  );
