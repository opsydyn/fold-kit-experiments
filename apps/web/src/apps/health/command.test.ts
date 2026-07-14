import { Effect } from 'effect';
import { FetchHttpClient } from 'effect/unstable/http';
import { describe, expect, test } from 'vitest';

import { FetchHealth } from './command';

const makeFetch =
  (response: Response): typeof globalThis.fetch =>
  () =>
    Promise.resolve(response);

describe('FetchHealth', () => {
  test('returns FetchedHealth when the Astro health API returns valid JSON', async () => {
    const message = await FetchHealth().effect.pipe(
      Effect.provideService(
        FetchHttpClient.Fetch,
        makeFetch(
          new Response(
            JSON.stringify({
              status: 'ok',
              uptimeSeconds: 12.5,
              startedAt: '2026-07-07T19:00:00.000Z',
              timestamp: '2026-07-07T19:00:12.500Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
      Effect.runPromise,
    );

    expect(message).toEqual({
      _tag: 'FetchedHealth',
      status: 'ok',
      uptimeSeconds: 12.5,
      startedAt: '2026-07-07T19:00:00.000Z',
      timestamp: '2026-07-07T19:00:12.500Z',
    });
  });
});
