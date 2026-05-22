import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as MapMessage } from '../../ui/map-projections-chart';

export const GotMapMessage = m('GotMapMessage', { inner: Schema.Unknown });
export type GotMapMessage = Omit<typeof GotMapMessage.Type, 'inner'> & {
  readonly inner: MapMessage;
};

export const Message = Schema.Union([GotMapMessage]);
export type Message = typeof Message.Type;
