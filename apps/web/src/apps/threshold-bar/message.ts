import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ThresholdBarMessage } from '../../ui/threshold-bar-chart';

export const GotThresholdBarMessage = m('GotThresholdBarMessage', { message: Schema.Unknown });
export type GotThresholdBarMessage = Omit<typeof GotThresholdBarMessage.Type, 'message'> & {
  readonly message: ThresholdBarMessage;
};

export const Message = Schema.Union([GotThresholdBarMessage]);
export type Message = typeof Message.Type;
