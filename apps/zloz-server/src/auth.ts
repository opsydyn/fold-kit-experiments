import { BetterAuth } from '@alchemy.run/better-auth';
import { Random } from 'alchemy';
import { APIError } from 'better-auth/api';
import { Config, Context, Effect, Layer, Redacted } from 'effect';

import { authOptions } from './auth-options';
import { emailBindingName, emailSignInConfig } from './email-sign-in';

export const AuthSecret = Random('ZlozTeamSigningSecret');

const authConfig = Config.all({
  baseURL: Config.String('ZLOZ_ORIGIN'),
  clientId: Config.String('GOOGLE_CLIENT_ID').pipe(Config.withDefault('')),
  clientSecret: Config.Redacted('GOOGLE_CLIENT_SECRET').pipe(Config.withDefault(Redacted.make(''))),
});

const makeAuth = Effect.gen(function* () {
  const config = yield* authConfig;
  const secret = yield* AuthSecret;
  const emailSignIn = yield* emailSignInConfig;
  const emailOptions = emailSignIn && {
    teamId: emailSignIn.teamId,
    send: async (email: string, code: string) => {
      const { env } = await import('cloudflare:workers');
      // SAFETY: The backend registers this native SendEmail binding when email sign-in is enabled.
      const binding = (env as Record<string, SendEmail | undefined>)[emailBindingName];
      const unavailable = () =>
        new APIError('SERVICE_UNAVAILABLE', { message: 'Email delivery is unavailable.' });
      if (!binding) throw unavailable();
      await binding
        .send({
          from: emailSignIn.from,
          to: email,
          subject: 'Your Teams sign-in code',
          text: 'Your Teams sign-in code is ' + code + '. It expires in 5 minutes.',
        })
        .catch(() => {
          throw unavailable();
        });
    },
  };
  return yield* BetterAuth({
    ...authOptions(
      config.baseURL,
      config.clientId,
      Redacted.value(config.clientSecret),
      emailOptions,
    ),
    migrate: false,
    secret: yield* secret.text,
  });
});

export class Auth extends Context.Service<Auth, Effect.Success<typeof makeAuth>>()('Zloz/Auth') {}
export const AuthLive = Layer.effect(Auth, makeAuth);
