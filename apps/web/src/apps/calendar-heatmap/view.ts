import type { Document } from 'foldkit/html';

import * as CalendarHeatmapChart from '../../ui/calendar-heatmap-chart';
import type { Message } from './message';
import { GotCalendarMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: CalendarHeatmapChart.Message): Message =>
  GotCalendarMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: 'Calendar Heatmap — foldkit-viz',
  body: CalendarHeatmapChart.view({
    model: model.calendar,
    toParentMessage,
    ariaLabel: '2025 commit activity calendar heatmap',
  }),
});
