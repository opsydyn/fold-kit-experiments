import { Schema } from 'effect';
import { m } from 'foldkit/message';

import { Locale } from './model';

export const Reset = m('Reset', {});
export const SelectedLocale = m('SelectedLocale', { locale: Locale });
export const Message = Schema.Union([Reset, SelectedLocale]);
export type Message = typeof Message.Type;
