import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ThresholdBarMessage } from '../../ui/threshold-bar-chart';

export const GotThresholdBarMessage = m('GotThresholdBarMessage', { inner: Schema.Unknown });
export type GotThresholdBarMessage = Omit<typeof GotThresholdBarMessage.Type, 'inner'> & {
  readonly inner: ThresholdBarMessage;
};

export const Message = Schema.Union([GotThresholdBarMessage]);
export type Message = typeof Message.Type;
