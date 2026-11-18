import { bodyText, BodyRejected } from '@opsydyn/zloz-server/src/http-body';
import { Option, Schema } from 'effect';

import { forward } from './backend';
import { continuation } from './continuation';

export const signIn = async (request: Request) => {
  if (request.method !== 'POST') return Option.none<Response>();
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin)
    return Option.some(new Response(null, { status: 403 }));
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))
    return Option.some(new Response('Submit the sign-in form.', { status: 415 }));
  let destination = '/app';
  try {
    destination = continuation(new URLSearchParams(await bodyText(request)).get('returnTo'));
  } catch (error) {
    return Option.some(
      new Response('Invalid sign-in form.', {
        status: error instanceof BodyRejected ? error.status : 400,
      }),
    );
  }
  const response = await forward(
    new Request(new URL('/api/auth/sign-in/social', origin), {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ provider: 'google', callbackURL: `${origin}${destination}` }),
    }),
  );
  if (!response.ok)
    return Option.some(
      new Response(
        'Sign-in is unavailable. Ask your team operator to check the Google configuration.',
        {
          status: 503,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'private, no-store',
          },
        },
      ),
    );
  const result = Schema.decodeUnknownSync(Schema.Struct({ url: Schema.String }))(
    await response.json(),
  );
  const headers = new Headers({ location: result.url, 'cache-control': 'private, no-store' });
  for (const value of response.headers.getSetCookie()) headers.append('set-cookie', value);
  return Option.some(new Response(null, { status: 303, headers }));
};
