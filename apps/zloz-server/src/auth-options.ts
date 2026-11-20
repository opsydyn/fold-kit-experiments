import type { BetterAuthPlugin } from 'better-auth';
import { APIError } from 'better-auth/api';
import { organization } from 'better-auth/plugins';
import { defaultAc, ownerAc } from 'better-auth/plugins/organization/access';
import { Schema } from 'effect';

import { invitedEmailCode, type EmailSignInOptions } from './email-sign-in';
import { Role } from './team-contract';

const supportedRole = (role: string) => {
  if (!Schema.is(Role)(role))
    throw new APIError('BAD_REQUEST', {
      code: 'ZLOZ_INVALID_ROLE',
      message: 'Choose owner, editor or viewer.',
    });
};

/** ADR 0036: one session and membership authority; provider credentials stay on the server. */
export const authOptions = (
  baseURL: string,
  clientId: string,
  clientSecret: string,
  emailSignIn?: EmailSignInOptions,
) => ({
  baseURL,
  basePath: '/api/auth',
  trustedOrigins: [baseURL],
  socialProviders:
    clientId && clientSecret
      ? { google: { clientId, clientSecret, prompt: 'select_account' as const } }
      : {},
  session: { cookieCache: { enabled: false } },
  advanced: {
    // Better Auth otherwise skips Origin validation under NODE_ENV=test.
    disableOriginCheck: false,
    disableCSRFCheck: false,
    ipAddress: emailSignIn
      ? { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] }
      : undefined,
    useSecureCookies: new URL(baseURL).protocol === 'https:',
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' as const, path: '/' },
  },
  rateLimit: { enabled: emailSignIn ? true : undefined },
  plugins: [
    organization({
      allowUserToCreateOrganization: false,
      requireEmailVerificationOnInvitation: true,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      membershipLimit: 10,
      organizationHooks: {
        beforeCreateInvitation: async ({ invitation }) => supportedRole(invitation.role),
        beforeUpdateMemberRole: async ({ newRole }) => supportedRole(newRole),
        beforeAddMember: async ({ member }) => supportedRole(member.role),
      },
      roles: {
        owner: ownerAc,
        editor: defaultAc.newRole({}),
        viewer: defaultAc.newRole({}),
      },
    }),
    ...(emailSignIn ? [invitedEmailCode(emailSignIn)] : []),
  ] satisfies [BetterAuthPlugin, ...BetterAuthPlugin[]],
});
