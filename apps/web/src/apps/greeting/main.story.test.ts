import { Schema } from 'effect';
import { expect, test } from 'vitest';

import { Message } from './message';
import { Props } from './model';
import { update } from './update';

test('selects Arabic and preserves it when resetting the name', () => {
  const initial = Schema.decodeSync(Props)({ name: 'astronaut', locale: 'en' });
  const arabic = update(initial, Message.SelectedLocale({ locale: 'ar' }));
  expect(arabic.locale).toBe('ar');
  const reset = update(arabic, Message.Reset());
  expect(reset).toEqual({ name: 'World', locale: 'ar' });
});
