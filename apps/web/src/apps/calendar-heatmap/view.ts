import type { Document, HtmlBuilder } from 'foldkit/html';

import * as CalendarHeatmapChart from '../../ui/calendar-heatmap-chart';
import type { Message } from './message';
import { GotCalendarMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: CalendarHeatmapChart.Message): Message =>
  GotCalendarMessage({ message: msg });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Calendar Heatmap — foldkit-viz',
  body: CalendarHeatmapChart.view(
    {
      model: model.calendar,
      toParentMessage,
      ariaLabel: '2025 commit activity calendar heatmap',
    },
    h,
  ),
});
