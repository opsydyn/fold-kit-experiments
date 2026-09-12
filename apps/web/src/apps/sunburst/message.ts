import { defineMessageUnion } from 'foldkit/message';

import * as SunburstChart from '../../ui/sunburst-chart';

export const Message = defineMessageUnion({
  GotSunburstMessage: {
    message: SunburstChart.Message,
  },
});
export type Message = typeof Message.Type;
