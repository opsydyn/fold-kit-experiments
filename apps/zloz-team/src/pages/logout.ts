import { bodyText, BodyRejected } from '@opsydyn/zloz-server/src/http-body';
import type { APIRoute } from 'astro';

import { forward } from '../server/backend';
import { continuation, loginPath } from '../server/continuation';

export const POST: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) return new Response(null, { status: 403 });
  const form = await bodyText(request)
    .then((text) => new URLSearchParams(text))
    .catch((error) => error);
  if (!(form instanceof URLSearchParams))
    return new Response('Invalid sign-out form.', {
      status: form instanceof BodyRejected ? form.status : 400,
    });
  const destination = form.has('returnTo')
    ? loginPath(continuation(form.get('returnTo')))
    : '/login';
  const response = await forward(
    new Request(new URL('/api/auth/sign-out', origin), {
      method: 'POST',
      headers: { origin, cookie: request.headers.get('cookie') ?? '' },
    }),
  );
  if (!response.ok) return new Response('Sign-out failed. Try again.', { status: 503 });
  const headers = new Headers({ location: destination, 'cache-control': 'private, no-store' });
  for (const cookie of response.headers.getSetCookie()) headers.append('set-cookie', cookie);
  return new Response(null, { status: 303, headers });
};
