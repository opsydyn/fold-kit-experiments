import { timingSafeEqual } from 'node:crypto';

import type { D1Database } from '@cloudflare/workers-types';
import type { Auth as BetterAuth } from 'better-auth';
import { Option, Schema } from 'effect';

import type { authOptions } from './auth-options';
import { bootstrapTeam, problem } from './bootstrap';
import { epochSql } from './date-sql';
import { BodyRejected, bodyText } from './http-body';
import {
  BootstrapCommand,
  CancelCommand,
  InviteCommand,
  InvitationView,
  MutationResult,
  normalizeEmail,
  RemoveCommand,
  Role,
  RoleCommand,
  TeamView,
} from './team-contract';

type NativeAuth = BetterAuth<ReturnType<typeof authOptions>>;
type TeamRow = { id: string; name: string; slug: string; role: string };
type MemberRow = { id: string; userId: string; name: string; email: string; role: Role };
type InviteRow = {
  id: string;
  email: string;
  role: Role;
  status: string;
  expiresAt: number;
  organizationId: string;
  name: string;
  slug: string;
};
type Session = NonNullable<Awaited<ReturnType<NativeAuth['api']['getSession']>>>;

const json = (
  value: typeof TeamView.Type | typeof InvitationView.Type | typeof MutationResult.Type,
) => Response.json(value, { headers: { 'cache-control': 'private, no-store' } });
const memberFor = (db: D1Database, teamId: string, memberId: string) =>
  db
    .prepare('SELECT id, userId, role FROM member WHERE organizationId = ? AND id = ?')
    .bind(teamId, memberId)
    .first<{ id: string; userId: string; role: Role }>();
const ownersIn = async (db: D1Database, teamId: string) =>
  (
    await db
      .prepare("SELECT COUNT(*) AS count FROM member WHERE organizationId = ? AND role = 'owner'")
      .bind(teamId)
      .first<{ count: number }>()
  )?.count ?? 0;

async function invitationFor(db: D1Database, session: Session, invitationId: string) {
  if (!session.user.emailVerified)
    return problem(
      403,
      'EmailNotVerified',
      'Use a verified Google account to open this invitation.',
    );
  const invitation = await db
    .prepare(`SELECT invitation.id, invitation.email, invitation.role, invitation.status, ${epochSql('invitation.expiresAt')} AS expiresAt, invitation.organizationId, organization.name, organization.slug
    FROM invitation JOIN organization ON organization.id = invitation.organizationId WHERE invitation.id = ?`)
    .bind(invitationId)
    .first<InviteRow>();
  if (!invitation) return problem(404, 'InvitationMissing', 'This invitation is unavailable.');
  if (normalizeEmail(invitation.email) !== normalizeEmail(session.user.email))
    return problem(
      403,
      'WrongRecipient',
      'This invitation belongs to another account. Sign out and use the invited Google account.',
    );
  const team = { id: invitation.organizationId, name: invitation.name, slug: invitation.slug };
  const member = await db
    .prepare('SELECT id FROM member WHERE organizationId = ? AND userId = ?')
    .bind(team.id, session.user.id)
    .first<{ id: string }>();
  if (member) return json({ _tag: 'Joined', team });
  if (invitation.status === 'accepted') return json({ _tag: 'Used' });
  if (invitation.status !== 'pending') return json({ _tag: 'Cancelled' });
  if (invitation.expiresAt <= Date.now()) return json({ _tag: 'Expired' });
  return json({
    _tag: 'Pending',
    id: invitation.id,
    email: invitation.email,
    team,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  });
}

async function nativeMutation(
  auth: NativeAuth,
  request: Request,
  origin: string,
  method: string,
  body: Readonly<Record<string, string>>,
) {
  return auth.handler(
    new Request(`${origin}/api/auth/organization/${method}`, {
      method: 'POST',
      headers: {
        origin,
        cookie: request.headers.get('cookie') ?? '',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
}

function mutationResult(teamId: string, destination: 'team' | 'home', source: Response) {
  const response = json({ teamId, destination });
  for (const cookie of source.headers.getSetCookie()) response.headers.append('set-cookie', cookie);
  return response;
}

async function mutationProblem(source: Response) {
  const body = await source.text();
  const decoded = Schema.decodeUnknownOption(
    Schema.fromJsonString(Schema.Struct({ code: Schema.optional(Schema.String) })),
  )(body);
  const code = Option.isSome(decoded) ? decoded.value.code : undefined;
  if (code?.includes('ONLY_OWNER') || code?.includes('WITHOUT_AN_OWNER'))
    return problem(
      409,
      'LastOwner',
      'Add another owner before changing or removing the last owner.',
    );
  if (code === 'ORGANIZATION_MEMBERSHIP_LIMIT_REACHED')
    return problem(409, 'TeamFull', 'This team has reached its ten-member pilot limit.');
  if (code === 'INVITATION_ALREADY_EXISTS')
    return problem(
      409,
      'InvitationExists',
      'An invitation is already pending. Share its existing link or cancel it first.',
    );
  if (code === 'USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION')
    return problem(409, 'AlreadyMember', 'This account is already a team member.');
  if (source.status === 401) return problem(401, 'SignInRequired', 'Sign in again to continue.');
  if (source.status === 403)
    return problem(
      403,
      'NotAllowed',
      'Your account cannot perform this action. Refresh the page to see current access.',
    );
  if (source.status < 500)
    return problem(
      409,
      'Changed',
      'This invitation or membership changed. Refresh the page and try again.',
    );
  return problem(
    503,
    'Unavailable',
    'The change could not be completed. Refresh the page before retrying.',
  );
}

async function teamRoute(request: Request, db: D1Database, auth: NativeAuth, origin: string) {
  const url = new URL(request.url);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return problem(401, 'SignInRequired', 'Sign in to continue.');
  const invitationPath = url.pathname.match(
    /^\/api\/zloz\/invitations\/([A-Za-z0-9_-]{1,128})(\/accept)?$/,
  );
  if (invitationPath) {
    const id = invitationPath[1] ?? '';
    if (request.method !== 'GET' && !(request.method === 'POST' && invitationPath[2]))
      return problem(405, 'MethodNotAllowed', 'Use the invitation action.');
    const response = await invitationFor(db, session, id);
    if (request.method === 'GET' || !response.ok) return response;
    const view = Schema.decodeUnknownSync(InvitationView)(await response.json());
    if (view._tag === 'Joined') return json({ teamId: view.team.id, destination: 'team' });
    if (view._tag !== 'Pending')
      return problem(
        409,
        'InvitationUnavailable',
        'This invitation is no longer available. Ask the team owner for a new invitation.',
      );
    const native = await nativeMutation(auth, request, origin, 'accept-invitation', {
      invitationId: id,
    });
    if (native.ok) return mutationResult(view.team.id, 'team', native);
    const current = await invitationFor(db, session, id);
    if (current.ok) {
      const state = Schema.decodeUnknownSync(InvitationView)(await current.json());
      if (state._tag === 'Joined') return mutationResult(state.team.id, 'team', native);
    }
    const count = await db
      .prepare('SELECT COUNT(*) AS count FROM member WHERE organizationId = ?')
      .bind(view.team.id)
      .first<{ count: number }>();
    if ((count?.count ?? 0) >= 10)
      return problem(409, 'TeamFull', 'This team has reached its ten-member pilot limit.');
    return mutationProblem(native);
  }
  const path = url.pathname.match(
    /^\/api\/zloz\/teams\/([A-Za-z0-9_-]{1,128})(?:\/(invite|cancel|role|remove))?$/,
  );
  if (!path) return problem(404, 'Missing', 'This team page is unavailable.');
  const teamId = path[1] ?? '';
  const action = path[2];
  const team = await db
    .prepare(`SELECT organization.id, organization.name, organization.slug, member.role FROM organization
    JOIN member ON member.organizationId = organization.id WHERE organization.id = ? AND member.userId = ?`)
    .bind(teamId, session.user.id)
    .first<TeamRow>();
  if (!team || !Schema.is(Role)(team.role))
    return problem(404, 'TeamMissing', 'This team is unavailable to your account.');
  if (request.method === 'GET' && !action) {
    const members =
      team.role === 'owner'
        ? (
            await db
              .prepare(`SELECT member.id, member.userId, user.name, user.email, member.role
      FROM member JOIN user ON user.id = member.userId WHERE organizationId = ? ORDER BY user.name, member.id`)
              .bind(teamId)
              .all<MemberRow>()
          ).results
        : [];
    const invitations =
      team.role === 'owner'
        ? (
            await db
              .prepare(
                `SELECT id, email, role, ${epochSql('expiresAt')} AS expiresAt, status FROM invitation WHERE organizationId = ? AND status = 'pending' ORDER BY createdAt DESC LIMIT 100`,
              )
              .bind(teamId)
              .all<{ id: string; email: string; role: Role; expiresAt: number; status: string }>()
          ).results
        : [];
    const diagrams = (
      await db
        .prepare(
          'SELECT diagramId AS id, name, updatedAt FROM diagramDirectory WHERE organizationId = ? ORDER BY updatedAt DESC LIMIT 100',
        )
        .bind(teamId)
        .all<{ id: string; name: string; updatedAt: number }>()
    ).results;
    return json({
      team: { id: team.id, name: team.name, slug: team.slug },
      role: team.role,
      currentUserId: session.user.id,
      members,
      invitations,
      diagrams,
    });
  }
  if (request.method !== 'POST' || !action)
    return problem(405, 'MethodNotAllowed', 'Use a team action.');
  if (team.role !== 'owner')
    return problem(403, 'OwnerRequired', 'Only a team owner can manage invitations and members.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return problem(415, 'JsonRequired', 'Submit a JSON team action.');
  const text = await bodyText(request);
  if (action === 'invite') {
    const command = Schema.decodeUnknownOption(Schema.fromJsonString(InviteCommand))(text);
    if (Option.isNone(command))
      return problem(
        400,
        'InvalidInvitation',
        'Enter a valid email address and select a team role.',
      );
    const native = await nativeMutation(auth, request, origin, 'invite-member', {
      organizationId: teamId,
      email: normalizeEmail(command.value.email),
      role: command.value.role,
    });
    return native.ok ? mutationResult(teamId, 'team', native) : mutationProblem(native);
  }
  if (action === 'cancel') {
    const command = Schema.decodeUnknownOption(Schema.fromJsonString(CancelCommand))(text);
    if (Option.isNone(command))
      return problem(400, 'InvalidInvitation', 'Choose a pending invitation.');
    const belongs = await db
      .prepare(
        "SELECT id FROM invitation WHERE id = ? AND organizationId = ? AND status = 'pending'",
      )
      .bind(command.value.invitationId, teamId)
      .first<{ id: string }>();
    if (!belongs)
      return problem(409, 'Changed', 'This invitation is no longer pending for this team.');
    const native = await nativeMutation(auth, request, origin, 'cancel-invitation', {
      invitationId: command.value.invitationId,
    });
    return native.ok ? mutationResult(teamId, 'team', native) : mutationProblem(native);
  }
  const command =
    action === 'role'
      ? Schema.decodeUnknownOption(Schema.fromJsonString(RoleCommand))(text)
      : Schema.decodeUnknownOption(Schema.fromJsonString(RemoveCommand))(text);
  if (Option.isNone(command))
    return problem(400, 'InvalidMember', 'Choose a member and a supported role.');
  const target = await memberFor(db, teamId, command.value.memberId);
  if (!target) return problem(409, 'Changed', 'This membership is no longer part of this team.');
  const desiredRole =
    action === 'role' && 'role' in command.value && Schema.is(Role)(command.value.role)
      ? command.value.role
      : undefined;
  if (target.role === 'owner' && desiredRole !== 'owner' && (await ownersIn(db, teamId)) <= 1)
    return problem(
      409,
      'LastOwner',
      'Add another owner before changing or removing the last owner.',
    );
  const native =
    action === 'role' && desiredRole
      ? await nativeMutation(auth, request, origin, 'update-member-role', {
          organizationId: teamId,
          memberId: target.id,
          role: desiredRole,
        })
      : await nativeMutation(auth, request, origin, 'remove-member', {
          organizationId: teamId,
          memberIdOrEmail: target.id,
        });
  if (!native.ok) {
    const current = await memberFor(db, teamId, target.id);
    if (current?.role === 'owner' && desiredRole !== 'owner' && (await ownersIn(db, teamId)) <= 1)
      return problem(
        409,
        'LastOwner',
        'Add another owner before changing or removing the last owner.',
      );
    return mutationProblem(native);
  }
  return mutationResult(
    teamId,
    action === 'remove' && target.userId === session.user.id ? 'home' : 'team',
    native,
  );
}

/** The native onboarding HTTP boundary; no exceptions or provider messages reach the UI. */
export async function handleTeamRequest(
  request: Request,
  db: D1Database,
  auth: NativeAuth,
  origin: string,
  operatorToken: string,
) {
  try {
    if (new URL(request.url).pathname === '/internal/bootstrap') {
      const provided = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
      if (
        !/^[a-f0-9]{64}$/.test(operatorToken) ||
        !/^[a-f0-9]{64}$/.test(provided) ||
        !timingSafeEqual(
          new TextEncoder().encode(provided),
          new TextEncoder().encode(operatorToken),
        )
      )
        return problem(403, 'OperatorRequired', 'Operator authorization is required.');
      if (request.method !== 'POST')
        return problem(405, 'MethodNotAllowed', 'Use the bootstrap task.');
      const command = Schema.decodeUnknownOption(Schema.fromJsonString(BootstrapCommand))(
        await bodyText(request),
      );
      if (Option.isNone(command))
        return problem(
          400,
          'InvalidBootstrap',
          'Supply an owner email, team name, slug and explicit apply flag.',
        );
      return await bootstrapTeam(db, command.value);
    }
    return await teamRoute(request, db, auth, origin);
  } catch (error) {
    if (error instanceof BodyRejected)
      return problem(error.status, 'InvalidBody', 'The submitted form is too large.');
    console.error('Zloz onboarding request failed');
    return problem(
      503,
      'Unavailable',
      'The team service is unavailable. Refresh the page before retrying.',
    );
  }
}
