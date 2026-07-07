import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as ChoroplethMessage } from '../../ui/choropleth-map';

export const GotChoroplethMessage = m('GotChoroplethMessage', { message: Schema.Unknown });
export type GotChoroplethMessage = Omit<typeof GotChoroplethMessage.Type, 'message'> & {
  readonly message: ChoroplethMessage;
};

export const Message = Schema.Union([GotChoroplethMessage]);
export type Message = typeof Message.Type;
