import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ZChoroplethMessage } from '../../ui/zoomable-choropleth-map';

export const GotZChoroplethMessage = m('GotZChoroplethMessage', { inner: Schema.Unknown });
export type GotZChoroplethMessage = Omit<typeof GotZChoroplethMessage.Type, 'inner'> & {
  readonly inner: ZChoroplethMessage;
};

export const Message = Schema.Union([GotZChoroplethMessage]);
export type Message = typeof Message.Type;
