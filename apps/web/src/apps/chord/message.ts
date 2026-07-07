import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ChordMessage } from '../../ui/chord-chart';

export const GotChordMessage = m('GotChordMessage', { message: Schema.Unknown });
export type GotChordMessage = Omit<typeof GotChordMessage.Type, 'message'> & {
  readonly message: ChordMessage;
};

export const Message = Schema.Union([GotChordMessage]);
export type Message = typeof Message.Type;
