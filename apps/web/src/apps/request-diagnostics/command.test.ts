import { Effect } from 'effect';
import { FetchHttpClient } from 'effect/unstable/http';
import { describe, expect, test } from 'vitest';

import { FetchMetrics } from './command';

const makeFetch =
  (response: Response): typeof globalThis.fetch =>
  () =>
    Promise.resolve(response);

describe('FetchMetrics', () => {
  test('decodes request diagnostics from the Astro API', async () => {
    const message = await FetchMetrics().effect.pipe(
      Effect.provideService(
        FetchHttpClient.Fetch,
        makeFetch(
          new Response(JSON.stringify([{ x: 120, y: 1.4, label: 'request-1' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
      Effect.runPromise,
    );

    expect(message).toEqual({
      _tag: 'LoadedMetrics',
      points: [{ x: 120, y: 1.4, label: 'request-1' }],
    });
  });
});
