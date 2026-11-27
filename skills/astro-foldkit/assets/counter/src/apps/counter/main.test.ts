import { expect, test } from 'bun:test';

import { HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';

import { Counter } from './main';

test('renders the public start value without a browser', async () => {
  const rendered = HtmlServer.renderToHtml(Counter, { start: 7 }, { static: true });
  expect((await Effect.runPromise(rendered)).html).toContain('Count: 7');
});
