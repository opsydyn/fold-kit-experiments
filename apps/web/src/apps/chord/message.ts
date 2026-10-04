import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ChordMessage } from '../../ui/chord-chart';

export const Message = defineMessageUnion({
  ReceivedChordMessage: { message: Schema.Unknown },
});
export type ReceivedChordMessage = Omit<typeof Message.ReceivedChordMessage.Type, 'message'> & {
  readonly message: ChordMessage;
};
export type Message = typeof Message.Type;
