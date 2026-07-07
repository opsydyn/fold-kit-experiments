import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as ColorSpacesMessage } from '../../ui/color-spaces-chart';

export const GotColorSpacesMessage = m('GotColorSpacesMessage', { message: Schema.Unknown });
export type GotColorSpacesMessage = Omit<typeof GotColorSpacesMessage.Type, 'message'> & {
  readonly message: ColorSpacesMessage;
};

export const Message = Schema.Union([GotColorSpacesMessage]);
export type Message = typeof Message.Type;
