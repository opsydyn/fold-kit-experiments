import { UiSchema } from '@effect/ui';

import { Locale } from './model';

export const Message = UiSchema.TaggedEnum({
  Reset: {},
  SelectedLocale: { locale: Locale },
});
export type Message = typeof Message.Type;
