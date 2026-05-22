import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as GaugeMessage } from '../../ui/gauge-chart';

export const GotGaugeMessage = m('GotGaugeMessage', { inner: Schema.Unknown });
export type GotGaugeMessage = Omit<typeof GotGaugeMessage.Type, 'inner'> & {
  readonly inner: GaugeMessage;
};

export const Message = Schema.Union([GotGaugeMessage]);
export type Message = typeof Message.Type;
