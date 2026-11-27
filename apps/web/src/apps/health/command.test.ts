import { Effect } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { describe, expect, test } from 'vitest';

import { FetchHealth } from './command';

const makeFetch =
  (response: Response): typeof globalThis.fetch =>
  () =>
    Promise.resolve(response);

const body = {
  status: 'ok',
  uptimeSeconds: 12.5,
  startedAt: '2026-07-07T19:00:00.000Z',
  timestamp: '2026-07-07T19:00:12.500Z',
};

const fetchHealth = (response: Response) =>
  FetchHealth.make({}).effect.pipe(
    Effect.provideService(FetchHttpClient.Fetch, makeFetch(response)),
    Effect.runPromise,
  );

describe('FetchHealth', () => {
  test('returns FetchedHealth when the Astro health API returns valid JSON', async () => {
    expect(await fetchHealth(Response.json(body))).toEqual({ _tag: 'FetchedHealth', ...body });
  });

  test('rejects a failed HTTP response even when it has a valid health payload', async () => {
    expect(await fetchHealth(Response.json(body, { status: 503 }))).toMatchObject({
      _tag: 'FetchFailed',
    });
  });

  test('reports a successful response with an invalid payload as a failure', async () => {
    expect(await fetchHealth(Response.json({ status: 'ok' }))).toMatchObject({
      _tag: 'FetchFailed',
    });
  });
});
