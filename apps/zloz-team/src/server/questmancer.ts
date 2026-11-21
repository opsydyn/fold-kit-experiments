import { env } from 'cloudflare:workers';
import { Schema } from 'effect';

import { isAccountId, seats, type Participant } from '../questmancer/contracts';
import { loadTeam } from './onboarding';

const Tableau = Schema.Union([
  Schema.Struct({ role: Schema.Literal('dm'), joined: Schema.Literal(true) }),
  Schema.Struct({
    role: Schema.Literal('player'),
    seat: Schema.Literals(seats),
    joined: Schema.Boolean,
  }),
]);
export const questmancerEnabled = (teamId: string) =>
  isAccountId(teamId) &&
  !!env.QUESTMANCER &&
  (env.QUESTMANCER_TEAM === '*' || env.QUESTMANCER_TEAM === teamId);
export const questmancerPreviewEnabled = (teamId: string) =>
  isAccountId(teamId) &&
  (env.QUESTMANCER_PREVIEW_TEAM === '*' || env.QUESTMANCER_PREVIEW_TEAM === teamId);
export const questmancerPath = (teamId: string) => `/app/${teamId}/questmancer`;

export function questmancerRequest(
  teamId: string,
  userId: string,
  action: string,
  body?: BodyInit | null,
): Promise<Response> {
  if (!questmancerEnabled(teamId) || !env.QUESTMANCER || !isAccountId(userId))
    return Promise.resolve(new Response(null, { status: 404 }));
  return env.QUESTMANCER.fetch(
    new Request(`https://questmancer.internal/${teamId}/${action}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers:
        action === 'live'
          ? { 'x-quest-user': userId, upgrade: 'websocket' }
          : { 'x-quest-user': userId, 'content-type': 'application/json' },
      body,
    }),
  );
}

export async function questmancerParticipant(
  teamId: string,
  userId: string,
): Promise<Participant | null> {
  const response = await questmancerRequest(teamId, userId, 'lobby');
  return response.ok ? Schema.decodeUnknownSync(Tableau)(await response.json()) : null;
}

export async function dashboardQuestmancer(
  request: Request,
  teams: readonly { id: string; name: string }[],
  userId: string,
) {
  const links = await Promise.all(
    teams
      .filter(({ id }) => questmancerEnabled(id) || questmancerPreviewEnabled(id))
      .map(async (team) => {
        const path = questmancerPath(team.id);
        const [access, participant] = await Promise.all([
          loadTeam(request, team.id),
          questmancerParticipant(team.id, userId),
        ]);
        const owner = access._tag === 'Ready' && access.value.role === 'owner';
        return [
          ...(participant
            ? [
                {
                  team,
                  path: participant.joined ? path + '/table' : path,
                  label: participant.joined ? 'Resume session' : 'Join party',
                },
              ]
            : owner && questmancerEnabled(team.id)
              ? [{ team, path, label: 'Host Moonwell' }]
              : []),
          ...(owner && questmancerPreviewEnabled(team.id)
            ? [{ team, path: path + '/preview', label: 'Preview Moonwell' }]
            : []),
        ];
      }),
  );
  return links.flat();
}
