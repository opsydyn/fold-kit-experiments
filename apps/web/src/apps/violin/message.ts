import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as ViolinMessage } from '../../ui/violin-chart';

export const GotViolinMessage = m('GotViolinMessage', { message: Schema.Unknown });
export type GotViolinMessage = Omit<typeof GotViolinMessage.Type, 'message'> & {
  readonly message: ViolinMessage;
};

export const Message = Schema.Union([GotViolinMessage]);
export type Message = typeof Message.Type;
