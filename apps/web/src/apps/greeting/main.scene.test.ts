import { HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { expect, test } from 'vitest';

import { Greeting } from './main';
import { Props } from './model';

test('server-renders the selected locale and both language controls', async () => {
  const props = Schema.decodeSync(Props)({ name: 'astronaut', locale: 'ar' });
  const { html } = await Effect.runPromise(HtmlServer.renderToHtml(Greeting, props));
  expect(html).toContain('مرحبا، astronaut!');
  expect(html).toContain('aria-label="Greeting language"');
  expect(html).toMatch(/aria-pressed="true"[^>]*>Arabic<\/button>/);
});
