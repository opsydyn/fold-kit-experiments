import { BetterAuth } from '@alchemy.run/better-auth';
import { Random } from 'alchemy';
import { Config, Context, Effect, Layer, Redacted } from 'effect';

import { authOptions } from './auth-options';

export const AuthSecret = Random('ZlozTeamSigningSecret');

const authConfig = Config.all({
  baseURL: Config.String('ZLOZ_ORIGIN'),
  clientId: Config.String('GOOGLE_CLIENT_ID').pipe(Config.withDefault('')),
  clientSecret: Config.Redacted('GOOGLE_CLIENT_SECRET').pipe(Config.withDefault(Redacted.make(''))),
});

const makeAuth = Effect.gen(function* () {
  const config = yield* authConfig;
  const secret = yield* AuthSecret;
  return yield* BetterAuth({
    ...authOptions(config.baseURL, config.clientId, Redacted.value(config.clientSecret)),
    migrate: false,
    secret: yield* secret.text,
  });
});

export class Auth extends Context.Service<Auth, Effect.Success<typeof makeAuth>>()('Zloz/Auth') {}
export const AuthLive = Layer.effect(Auth, makeAuth);
