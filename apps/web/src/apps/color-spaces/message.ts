import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ColorSpacesMessage } from '../../ui/color-spaces-chart';

export const Message = defineMessageUnion({
  GotColorSpacesMessage: { message: Schema.Unknown },
});
export type GotColorSpacesMessage = Omit<typeof Message.GotColorSpacesMessage.Type, 'message'> & {
  readonly message: ColorSpacesMessage;
};
export type Message = typeof Message.Type;
