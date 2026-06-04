import { Schema } from 'effect';
import { m } from 'foldkit/message';
import * as SunburstChart from '../../ui/sunburst-chart';

export const GotSunburstMessage = m('GotSunburstMessage', {
  inner: SunburstChart.Message,
});

export const Message = Schema.Union([GotSunburstMessage]);
export type Message = typeof Message.Type;
