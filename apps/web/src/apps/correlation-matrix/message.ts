import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as CorrMessage } from '../../ui/correlation-matrix';

export const GotCorrMessage = m('GotCorrMessage', { inner: Schema.Unknown });
export type GotCorrMessage = Omit<typeof GotCorrMessage.Type, 'inner'> & {
  readonly inner: CorrMessage;
};
export const Message = Schema.Union([GotCorrMessage]);
export type Message = typeof Message.Type;
