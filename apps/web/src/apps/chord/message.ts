import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ChordMessage } from '../../ui/chord-chart';

export const Message = defineMessageUnion({
  GotChordMessage: { message: Schema.Unknown },
});
export type GotChordMessage = Omit<typeof Message.GotChordMessage.Type, 'message'> & {
  readonly message: ChordMessage;
};
export type Message = typeof Message.Type;
