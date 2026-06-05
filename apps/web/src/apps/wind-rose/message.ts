import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as WRMessage } from '../../ui/wind-rose-chart';
export const GotWRMessage = m('GotWRMessage', { inner: Schema.Unknown });
export type GotWRMessage = Omit<typeof GotWRMessage.Type, 'inner'> & { readonly inner: WRMessage };
export const Message = Schema.Union([GotWRMessage]);
export type Message = typeof Message.Type;
