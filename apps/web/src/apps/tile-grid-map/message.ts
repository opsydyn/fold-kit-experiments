import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as TGMessage } from '../../ui/tile-grid-map';
export const GotTGMessage = m('GotTGMessage', { inner: Schema.Unknown });
export type GotTGMessage = Omit<typeof GotTGMessage.Type, 'inner'> & { readonly inner: TGMessage };
export const Message = Schema.Union([GotTGMessage]);
export type Message = typeof Message.Type;
