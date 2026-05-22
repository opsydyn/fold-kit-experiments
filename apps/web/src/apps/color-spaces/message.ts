import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ColorSpacesMessage } from '../../ui/color-spaces-chart';

export const GotColorSpacesMessage = m('GotColorSpacesMessage', { inner: Schema.Unknown });
export type GotColorSpacesMessage = Omit<typeof GotColorSpacesMessage.Type, 'inner'> & {
  readonly inner: ColorSpacesMessage;
};

export const Message = Schema.Union([GotColorSpacesMessage]);
export type Message = typeof Message.Type;
