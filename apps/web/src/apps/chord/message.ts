import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ChordMessage } from '../../ui/chord-chart';

export const GotChordMessage = m('GotChordMessage', { inner: Schema.Unknown });
export type GotChordMessage = Omit<typeof GotChordMessage.Type, 'inner'> & {
  readonly inner: ChordMessage;
};

export const Message = Schema.Union([GotChordMessage]);
export type Message = typeof Message.Type;
