import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as RadarMessage } from '../../ui/radar-chart';

export const GotRadarMessage = m('GotRadarMessage', { inner: Schema.Unknown });
export type GotRadarMessage = Omit<typeof GotRadarMessage.Type, 'inner'> & {
  readonly inner: RadarMessage;
};

export const Message = Schema.Union([GotRadarMessage]);
export type Message = typeof Message.Type;
