import { BodyRejected, bodyText } from '@opsydyn/zloz-server/src/http-body';
import {
  Email,
  normalizeEmail,
  emailCodePath,
  emailVerifyPath,
  emailInvitationHeader,
} from '@opsydyn/zloz-server/src/team-contract';
import { Schema } from 'effect';

import { forward } from './backend';
import { continuation } from './continuation';

export type EmailForm = Readonly<{
  returnTo: string;
  email: string;
  step: 'email' | 'code';
  error?: string;
}>;

const headers = { 'cache-control': 'private, no-store' };

export async function emailSignIn(request: Request): Promise<EmailForm | Response> {
  const url = new URL(request.url);
  const start = {
    returnTo: continuation(url.searchParams.get('returnTo')),
    email: '',
    step: 'email',
  } as const;
  if (request.method === 'GET' || request.method === 'HEAD') return start;
  if (request.method !== 'POST') return new Response(null, { status: 405, headers });
  if (request.headers.get('origin') !== url.origin)
    return new Response(null, { status: 403, headers });
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))
    return new Response(null, { status: 415, headers });

  const parsed = await bodyText(request).then(
    (value) => ({ form: new URLSearchParams(value), status: 200 }),
    (error) => ({
      form: null,
      status: error instanceof BodyRejected ? error.status : 400,
    }),
  );
  if (!parsed.form) return new Response(null, { status: parsed.status, headers });
  const { form } = parsed;
  const returnTo = continuation(form.get('returnTo'));
  const email = normalizeEmail(form.get('email') ?? '');
  const step = form.get('action') === 'verify' ? 'code' : 'email';
  const otp = form.get('code') ?? '';
  const fields = { returnTo, email, step } as const;
  if (!Schema.is(Email)(email))
    return { ...fields, step: 'email', error: 'Enter the email address on your invitation.' };
  if (step === 'code' && !/^\d{6}$/.test(otp))
    return { ...fields, error: 'Enter the six-digit code.' };

  const outgoing = new Headers({ origin: url.origin, 'content-type': 'application/json' });
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) outgoing.set('cf-connecting-ip', clientIp);
  if (returnTo.startsWith('/join/')) outgoing.set(emailInvitationHeader, returnTo.slice(6));

  const response = await forward(
    new Request(new URL('/api/auth' + (step === 'code' ? emailVerifyPath : emailCodePath), url), {
      method: 'POST',
      headers: outgoing,
      body: JSON.stringify(
        step === 'code'
          ? { email, otp, name: email.split('@')[0]?.slice(0, 100) }
          : { email, type: 'sign-in' },
      ),
    }),
  );
  if (response.status === 429)
    return { ...fields, error: 'Too many tries. Wait a minute and try again.' };
  if (!response.ok)
    return {
      ...fields,
      error:
        step === 'code'
          ? 'That code didn’t work. Check it or request another.'
          : 'Email delivery is unavailable. Try again shortly.',
    };
  if (step === 'email') return { ...fields, step: 'code' };

  const reply = new Headers({ ...headers, location: returnTo });
  const cookies = response.headers.getSetCookie();
  if (cookies.length === 0)
    return { ...fields, error: 'Sign-in did not finish. Request another code.' };
  for (const cookie of cookies) reply.append('set-cookie', cookie);
  return new Response(null, { status: 303, headers: reply });
}
