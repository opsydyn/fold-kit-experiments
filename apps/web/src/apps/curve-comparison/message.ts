import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as CurveMessage } from '../../ui/curve-comparison-chart';

export const GotCurveMessage = m('GotCurveMessage', { message: Schema.Unknown });
export type GotCurveMessage = Omit<typeof GotCurveMessage.Type, 'message'> & {
  readonly message: CurveMessage;
};

export const Message = Schema.Union([GotCurveMessage]);
export type Message = typeof Message.Type;
