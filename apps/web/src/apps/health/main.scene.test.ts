import { HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';
import { expect, test } from 'vitest';

import { Health } from './main';
import { Message } from './message';
import { init } from './model';
import { update } from './update';

test('server-renders a loading state before the browser fetch', async () => {
  const { html } = await Effect.runPromise(HtmlServer.renderToHtml(Health, {}));
  expect(html).toContain('aria-busy="true"');
});

test('frame deltas advance only a loaded health check', () => {
  const tick = Message.TickedFrame({ deltaTimeMs: 500 });
  const loaded = update(
    init,
    Message.FetchedHealth({
      status: 'ok',
      uptimeSeconds: 12,
      startedAt: '2026-07-07T19:00:00.000Z',
      timestamp: '2026-07-07T19:00:12.000Z',
    }),
  );
  expect(update(init, tick)).toBe(init);
  expect(update(loaded, tick)).toMatchObject({ _tag: 'Loaded', elapsedMs: 500 });
});
