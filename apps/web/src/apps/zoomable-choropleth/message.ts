import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as ZChoroplethMessage } from '../../ui/zoomable-choropleth-map';

export const GotZChoroplethMessage = m('GotZChoroplethMessage', { message: Schema.Unknown });
export type GotZChoroplethMessage = Omit<typeof GotZChoroplethMessage.Type, 'message'> & {
  readonly message: ZChoroplethMessage;
};

export const Message = Schema.Union([GotZChoroplethMessage]);
export type Message = typeof Message.Type;
