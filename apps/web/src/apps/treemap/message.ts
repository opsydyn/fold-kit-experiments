import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as TreemapMessage } from '../../ui/treemap-chart';

export const GotTreemapMessage = m('GotTreemapMessage', { message: Schema.Unknown });
export type GotTreemapMessage = Omit<typeof GotTreemapMessage.Type, 'message'> & {
  readonly message: TreemapMessage;
};

export const Message = Schema.Union([GotTreemapMessage]);
export type Message = typeof Message.Type;
