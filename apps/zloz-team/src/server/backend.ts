import { env } from 'cloudflare:workers';
import { Data, Schema } from 'effect';

export class BackendUnavailable extends Data.TaggedError('BackendUnavailable') {}

const Session = Schema.NullOr(
  Schema.Struct({
    user: Schema.Struct({ id: Schema.String, name: Schema.String, email: Schema.String }),
  }),
);
const Teams = Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String }));

export const forward = (request: Request) => env.ZLOZ_BACKEND.fetch(request);

export const sessionFor = async (request: Request) => {
  const response = await forward(
    new Request(new URL('/api/zloz/session', request.url), {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    }),
  );
  if (!response.ok) throw new BackendUnavailable();
  return Schema.decodeUnknownSync(Session)(await response.json());
};

export const teamsFor = async (request: Request) => {
  const response = await forward(
    new Request(new URL('/api/auth/organization/list', request.url), {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    }),
  );
  if (!response.ok) throw new BackendUnavailable();
  return Schema.decodeUnknownSync(Teams)(await response.json());
};

export const signInMethods = async (request: Request) => {
  const response = await forward(new Request(new URL('/api/zloz/capabilities', request.url)));
  if (!response.ok) throw new BackendUnavailable();
  return Schema.decodeUnknownSync(
    Schema.Struct({
      google: Schema.Boolean,
      emailCode: Schema.optional(Schema.Boolean),
    }),
  )(await response.json());
};
