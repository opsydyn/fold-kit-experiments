import { expect, test } from 'bun:test';

import { stagingBootstrapRequest } from '../src/staging-bootstrap';

const origin = 'https://teams-staging.opsydyn.xyz';
const request = (source = origin) =>
  new Request(`${origin}/api/zloz/operator/bootstrap`, {
    method: 'POST',
    headers: {
      origin: source,
      authorization: 'Bearer retained',
      'content-type': 'application/json',
    },
    body: '{"apply":false}',
  });
test('operator bridge requires explicit staging configuration and exact origin, preserving the existing token boundary', async () => {
  expect(stagingBootstrapRequest(request(), origin, false)).toBeNull();
  expect(stagingBootstrapRequest(request(), 'https://zloz.opsydyn.xyz', true)).toBeNull();
  expect(stagingBootstrapRequest(request('https://foreign.example'), origin, true)).toBeNull();
  const forwarded = stagingBootstrapRequest(request(), origin, true);
  expect(forwarded?.url).toBe(`${origin}/internal/bootstrap`);
  expect(forwarded?.headers.get('authorization')).toBe('Bearer retained');
  expect(await forwarded?.text()).toBe('{"apply":false}');
});
