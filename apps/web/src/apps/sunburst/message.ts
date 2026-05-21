import { Schema } from 'effect';
import * as SunburstChart from '../../ui/sunburst-chart';
import { m } from 'foldkit/message';

export const GotSunburstMessage = m('GotSunburstMessage', {
  inner: SunburstChart.Message,
});

export const Message = Schema.Union([GotSunburstMessage]);
export type Message = typeof Message.Type;
