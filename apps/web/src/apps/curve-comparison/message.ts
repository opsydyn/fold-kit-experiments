import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as CurveMessage } from '../../ui/curve-comparison-chart';

export const GotCurveMessage = m('GotCurveMessage', { inner: Schema.Unknown });
export type GotCurveMessage = Omit<typeof GotCurveMessage.Type, 'inner'> & {
  readonly inner: CurveMessage;
};

export const Message = Schema.Union([GotCurveMessage]);
export type Message = typeof Message.Type;
