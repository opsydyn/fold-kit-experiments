import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as AreaMessage } from '../../ui/area-chart';

export const GotAreaMessage = m('GotAreaMessage', { message: Schema.Unknown });
export type GotAreaMessage = Omit<typeof GotAreaMessage.Type, 'message'> & {
  readonly message: AreaMessage;
};

export const Message = Schema.Union([GotAreaMessage]);
export type Message = typeof Message.Type;
