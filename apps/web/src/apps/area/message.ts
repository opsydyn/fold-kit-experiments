import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as AreaMessage } from '../../ui/area-chart';

export const GotAreaMessage = m('GotAreaMessage', { inner: Schema.Unknown });
export type GotAreaMessage = Omit<typeof GotAreaMessage.Type, 'inner'> & {
  readonly inner: AreaMessage;
};

export const Message = Schema.Union([GotAreaMessage]);
export type Message = typeof Message.Type;
