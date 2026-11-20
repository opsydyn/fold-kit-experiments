import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { Config, Effect, Schema } from 'effect';

import {
  Email,
  Id,
  normalizeEmail,
  emailCodePath,
  emailVerifyPath,
  emailInvitationHeader,
} from './team-contract';

export const emailBindingName = 'ZLOZ_SIGN_IN_EMAIL';
const stagingOrigin = 'https://teams-staging.opsydyn.xyz';

const emailTeam = Config.String('ZLOZ_EMAIL_SIGN_IN_TEAM').pipe(Config.withDefault(''));
const emailSender = Config.String('ZLOZ_EMAIL_SIGN_IN_FROM').pipe(Config.withDefault(''));

export const emailSignInConfig = Effect.gen(function* () {
  const origin = yield* Config.String('ZLOZ_ORIGIN');
  const teamId = yield* emailTeam;
  const from = yield* emailSender;
  const local = new URL(origin).hostname === 'localhost' && new URL(origin).protocol === 'http:';
  const allowedTeam = local && teamId === '*' ? true : Schema.is(Id)(teamId);
  return (local || origin === stagingOrigin) && allowedTeam && Schema.is(Email)(from)
    ? { teamId, from }
    : undefined;
});

export type EmailSignInOptions = Readonly<{
  teamId: string;
  send: (email: string, code: string) => Promise<void>;
}>;

const Invitation = Schema.Struct({
  email: Schema.String,
  status: Schema.String,
  expiresAt: Schema.Date,
  organizationId: Schema.String,
});

export function invitedEmailCode({ teamId, send }: EmailSignInOptions) {
  const plugin = emailOTP({
    expiresIn: 300,
    storeOTP: 'hashed',
    allowedAttempts: 3,
    rateLimit: { window: 60, max: 5 },
    sendVerificationOTP: ({ email, otp }) => send(email, otp),
  });

  return {
    ...plugin,
    endpoints: {
      sendVerificationOTP: plugin.endpoints.sendVerificationOTP,
      signInEmailOTP: plugin.endpoints.signInEmailOTP,
    },
    hooks: {
      before: [
        {
          matcher: ({ path }: { path?: string }) =>
            path === emailCodePath || path === emailVerifyPath,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.path === emailCodePath && ctx.body?.type !== 'sign-in')
              throw new APIError('BAD_REQUEST', { message: 'Choose a sign-in code.' });
            if (!Schema.is(Email)(ctx.body?.email))
              throw new APIError('BAD_REQUEST', { message: 'Enter an email address.' });
            const email = normalizeEmail(ctx.body.email);
            const invitationId = ctx.headers?.get(emailInvitationHeader);
            const adapter = ctx.context.adapter;
            const invitation = Schema.is(Id)(invitationId)
              ? await adapter.findOne<typeof Invitation.Type>({
                  model: 'invitation',
                  where: [{ field: 'id', value: invitationId }],
                })
              : null;
            if (
              invitation &&
              (teamId === '*' || invitation.organizationId === teamId) &&
              invitation.status === 'pending' &&
              invitation.expiresAt.getTime() > Date.now() &&
              normalizeEmail(invitation.email) === email
            )
              return;

            const user = await adapter.findOne<{ id: string }>({
              model: 'user',
              where: [
                { field: 'email', value: email },
                { field: 'emailVerified', value: true },
              ],
            });
            const member =
              user &&
              (await adapter.findOne({
                model: 'member',
                where:
                  teamId === '*'
                    ? [{ field: 'userId', value: user.id }]
                    : [
                        { field: 'userId', value: user.id },
                        { field: 'organizationId', value: teamId },
                      ],
              }));
            if (member) return;
            if (ctx.path === emailCodePath) return ctx.json({ success: true });
            throw new APIError('BAD_REQUEST', { message: 'Check your code and email address.' });
          }),
        },
      ],
    },
  };
}
