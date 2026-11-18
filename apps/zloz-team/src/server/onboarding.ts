import { bodyText, BodyRejected } from '@opsydyn/zloz-server/src/http-body';
import {
  InviteCommand,
  InvitationView,
  MutationResult,
  Problem,
  Role,
  TeamView,
} from '@opsydyn/zloz-server/src/team-contract';
import { Match, Option, Schema } from 'effect';

import { forward } from './backend';
import { loginPath } from './continuation';

const readPath = (request: Request, path: string) =>
  forward(
    new Request(new URL(path, request.url), {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    }),
  );

async function failure(response: Response) {
  const decoded = Schema.decodeUnknownOption(Schema.fromJsonString(Problem))(await response.text());
  return {
    _tag: 'Failure' as const,
    status: response.status,
    message: Option.isSome(decoded)
      ? decoded.value.message
      : 'The team service is unavailable. Try again.',
  };
}

export async function loadTeam(request: Request, teamId: string) {
  const response = await readPath(request, `/api/zloz/teams/${encodeURIComponent(teamId)}`);
  if (!response.ok) return failure(response);
  return {
    _tag: 'Ready' as const,
    value: Schema.decodeUnknownSync(TeamView)(await response.json()),
  };
}

export async function loadInvitation(request: Request, invitationId: string) {
  const response = await readPath(
    request,
    `/api/zloz/invitations/${encodeURIComponent(invitationId)}`,
  );
  if (!response.ok) return failure(response);
  return {
    _tag: 'Ready' as const,
    value: Schema.decodeUnknownSync(InvitationView)(await response.json()),
  };
}

const rejected = (status: number, message: string, email = '', role: Role = 'editor') => ({
  _tag: 'Rejected' as const,
  status,
  message,
  email,
  role,
});
const redirected = (location: string, response: Response) => {
  const headers = new Headers({ location, 'cache-control': 'private, no-store' });
  for (const cookie of response.headers.getSetCookie()) headers.append('set-cookie', cookie);
  return { _tag: 'Redirect' as const, response: new Response(null, { status: 303, headers }) };
};

/** Native SSR form boundary: no browser role/session state is trusted. */
export async function teamAction(request: Request, teamId: string) {
  if (request.method !== 'POST') return { _tag: 'Idle' as const };
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin)
    return rejected(403, 'This form must be submitted from this site.');
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))
    return rejected(415, 'Submit the team form.');
  try {
    const form = new URLSearchParams(await bodyText(request));
    const action = form.get('action');
    const email = (form.get('email') ?? '').trim();
    const role = Schema.is(Role)(form.get('role'))
      ? Schema.decodeUnknownSync(Role)(form.get('role'))
      : 'editor';
    const path = `/api/zloz/teams/${encodeURIComponent(teamId)}`;
    const command = Match.value(action).pipe(
      Match.when('invite', () => {
        const input = Schema.decodeUnknownOption(InviteCommand)({ email, role: form.get('role') });
        return Option.isSome(input) ? { action: 'invite', body: input.value } : undefined;
      }),
      Match.when('cancel', () => ({
        action: 'cancel',
        body: { invitationId: form.get('invitationId') },
      })),
      Match.when('role', () => ({
        action: 'role',
        body: { memberId: form.get('memberId'), role: form.get('role') },
      })),
      Match.when('remove', () => ({ action: 'remove', body: { memberId: form.get('memberId') } })),
      Match.orElse(() => undefined),
    );
    if (!command)
      return rejected(
        400,
        'Enter valid invitation details or choose a member action.',
        email,
        role,
      );
    const response = await forward(
      new Request(new URL(`${path}/${command.action}`, origin), {
        method: 'POST',
        headers: {
          origin,
          cookie: request.headers.get('cookie') ?? '',
          'content-type': 'application/json',
        },
        body: JSON.stringify(command.body),
      }),
    );
    if (response.status === 401) return redirected(loginPath(`/app/${teamId}`), response);
    if (!response.ok) {
      const error = await failure(response);
      return rejected(error.status, error.message, email, role);
    }
    const result = Schema.decodeUnknownSync(MutationResult)(await response.json());
    return redirected(
      result.destination === 'home'
        ? '/app?notice=left'
        : `/app/${result.teamId}?notice=${command.action}`,
      response,
    );
  } catch (error) {
    if (error instanceof BodyRejected) return rejected(error.status, 'This form is too large.');
    return rejected(503, 'The change could not be completed. Refresh the page before retrying.');
  }
}

export async function acceptInvitation(request: Request, invitationId: string) {
  if (request.method !== 'POST') return { _tag: 'Idle' as const };
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin)
    return rejected(403, 'This form must be submitted from this site.');
  const response = await forward(
    new Request(
      new URL(`/api/zloz/invitations/${encodeURIComponent(invitationId)}/accept`, origin),
      {
        method: 'POST',
        headers: {
          origin,
          cookie: request.headers.get('cookie') ?? '',
          'content-type': 'application/json',
        },
        body: '{}',
      },
    ),
  );
  if (response.status === 401) return redirected(loginPath(`/join/${invitationId}`), response);
  if (!response.ok) {
    const error = await failure(response);
    return rejected(error.status, error.message);
  }
  const result = Schema.decodeUnknownSync(MutationResult)(await response.json());
  return redirected(`/app/${result.teamId}`, response);
}

export const teamNotice = (value: string | null) =>
  Match.value(value).pipe(
    Match.when('invite', () => 'Invitation ready. Share the link with its named recipient.'),
    Match.when('cancel', () => 'Invitation cancelled.'),
    Match.when('role', () => 'Member role updated.'),
    Match.when('remove', () => 'Member removed.'),
    Match.orElse(() => ''),
  );

export const invitationMessage = (view: typeof InvitationView.Type) =>
  Match.value(view).pipe(
    Match.tag('Expired', () => 'This invitation has expired. Ask the team owner for a new link.'),
    Match.tag('Cancelled', () => 'The team owner cancelled this invitation.'),
    Match.tag(
      'Used',
      () => 'This invitation has already been used. Ask the team owner for a new invitation.',
    ),
    Match.orElse(() => ''),
  );

export const expiresLabel = (timestamp: number) =>
  `${new Date(timestamp).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
