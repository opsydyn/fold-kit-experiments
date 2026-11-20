import { expect, test } from 'bun:test';

import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';

import { authOptions } from '../src/auth-options';

const origin = 'http://localhost:4331';
const teamId = 'moonwell';
const codePath = '/email-otp/send-verification-otp';
const signInPath = '/sign-in/email-otp';
const brasswick = 'qa+brasswick@example.test';
const wicket = 'qa+wicket@example.test';

function setup() {
  const expiresAt = new Date(Date.now() + 60_000);
  const verification: { expiresAt: Date }[] = [];
  const data = {
    user: [],
    account: [],
    session: [],
    member: [],
    organization: [],
    verification,
    invitation: [
      { id: 'brasswick', email: brasswick, organizationId: teamId, status: 'pending', expiresAt },
      { id: 'wicket', email: wicket, organizationId: teamId, status: 'pending', expiresAt },
      { id: 'other', email: brasswick, organizationId: 'other-team', status: 'pending', expiresAt },
    ],
  };
  const outbox = new Map<string, string>();
  const auth = betterAuth({
    ...authOptions(origin, '', '', {
      teamId,
      send: async (email, code) => {
        outbox.set(email, code);
      },
    }),
    database: memoryAdapter(data),
    secret: 'only-for-local-verification-of-the-sign-in-plugin',
  });
  let address = 1;
  const post = (
    path: string,
    body: Readonly<Record<string, string | undefined>>,
    invitationId?: string,
  ) => {
    const headers = new Headers({
      origin,
      'content-type': 'application/json',
      'x-forwarded-for': '192.0.2.' + address++,
    });
    if (invitationId) headers.set('x-zloz-invitation', invitationId);
    return auth.handler(
      new Request(origin + '/api/auth' + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }),
    );
  };
  return { data, outbox, post };
}

test('two exact plus addresses can verify as distinct accounts before joining a team', async () => {
  const { outbox, post, data } = setup();
  const identities = new Set<string>();
  for (const [email, invitation] of [
    [brasswick, 'brasswick'],
    [wicket, 'wicket'],
  ] as const) {
    expect((await post(codePath, { email, type: 'sign-in' }, invitation)).status).toBe(200);
    const code = outbox.get(email);
    expect(code).toMatch(/^\d{6}$/);
    const response = await post(signInPath, { email, otp: code, name: invitation }, invitation);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
    // SAFETY: The successful Better Auth response contains its signed-in user.
    const result = (await response.json()) as {
      user: { id: string; email: string; emailVerified: boolean };
    };
    expect(result.user.email).toBe(email);
    expect(result.user.emailVerified).toBe(true);
    identities.add(result.user.id);
    expect((await post(signInPath, { email, otp: code }, invitation)).ok).toBe(false);
  }
  expect(identities.size).toBe(2);
  expect(data.member).toEqual([]);
});

test('wrong addresses, other teams, and expired codes cannot create a session', async () => {
  const { outbox, post, data } = setup();
  for (const invitation of ['wicket', 'other', undefined]) {
    expect((await post(codePath, { email: brasswick, type: 'sign-in' }, invitation)).status).toBe(
      200,
    );
  }
  expect(outbox.size).toBe(0);
  expect(
    (await post('/email-otp/verify-email', { email: brasswick, otp: '123456' }, 'brasswick'))
      .status,
  ).toBe(404);
  expect(
    (await post(codePath, { email: brasswick, type: 'forget-password' }, 'brasswick')).status,
  ).toBe(400);
  expect((await post(codePath, { email: brasswick, type: 'sign-in' }, 'brasswick')).status).toBe(
    200,
  );
  const code = outbox.get(brasswick);
  expect(code).toMatch(/^\d{6}$/);
  expect((await post(signInPath, { email: brasswick, otp: code }, 'other')).ok).toBe(false);
  const [verification] = data.verification;
  expect(verification).toBeDefined();
  if (verification) verification.expiresAt = new Date(0);
  expect((await post(signInPath, { email: brasswick, otp: code }, 'brasswick')).ok).toBe(false);
  expect(data.user).toEqual([]);
});
