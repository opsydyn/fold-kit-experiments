import { defineMessageUnion } from 'foldkit/message';

import { Locale } from './model';

export const Message = defineMessageUnion({
  Reset: {},
  SelectedLocale: { locale: Locale },
});
export type Message = typeof Message.Type;
