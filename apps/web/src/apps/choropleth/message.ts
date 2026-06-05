import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ChoroplethMessage } from '../../ui/choropleth-map';

export const GotChoroplethMessage = m('GotChoroplethMessage', { inner: Schema.Unknown });
export type GotChoroplethMessage = Omit<typeof GotChoroplethMessage.Type, 'inner'> & {
  readonly inner: ChoroplethMessage;
};

export const Message = Schema.Union([GotChoroplethMessage]);
export type Message = typeof Message.Type;
