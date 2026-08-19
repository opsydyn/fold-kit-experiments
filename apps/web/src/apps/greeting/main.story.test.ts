import { Schema } from 'effect';
import { Story } from 'foldkit';
import { describe, expect, test } from 'vitest';

import { Reset, SelectedLocale } from './message';
import { Flags, init } from './model';
import { update } from './update';

const initialModel = init(Schema.decodeSync(Flags)({ name: 'astronaut', locale: 'en' }))[0];

describe('greeting update', () => {
  test('selects Arabic and preserves it when the name resets', () => {
    Story.story(
      update,
      Story.given(initialModel),
      Story.message(SelectedLocale({ locale: 'ar' })),
      Story.model((model) => expect(model.locale).toBe('ar')),
      Story.message(Reset()),
      Story.model((model) => {
        expect(model.name).toBe('World');
        expect(model.locale).toBe('ar');
      }),
      Story.Command.expectNone(),
    );
  });
});
