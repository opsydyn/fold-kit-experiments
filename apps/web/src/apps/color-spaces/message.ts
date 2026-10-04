import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ColorSpacesMessage } from '../../ui/color-spaces-chart';

export const Message = defineMessageUnion({
  ReceivedColorSpacesMessage: { message: Schema.Unknown },
});
export type ReceivedColorSpacesMessage = Omit<
  typeof Message.ReceivedColorSpacesMessage.Type,
  'message'
> & {
  readonly message: ColorSpacesMessage;
};
export type Message = typeof Message.Type;
