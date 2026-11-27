import { HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';
import { expect, test } from 'vitest';

import { Counter } from './main';

test('server-renders the count and all three controls', async () => {
  const { html } = await Effect.runPromise(HtmlServer.renderToHtml(Counter, {}));
  expect(html).toMatch(/<output[^>]*>0<\/output>/);
  for (const label of ['−', 'Reset', '+']) {
    expect(html).toContain(`>${label}</button>`);
  }
});
