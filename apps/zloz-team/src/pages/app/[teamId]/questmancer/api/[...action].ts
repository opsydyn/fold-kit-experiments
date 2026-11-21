import type { APIRoute } from 'astro';

import { loadTeam } from '../../../../../server/onboarding';
import { questmancerEnabled, questmancerRequest } from '../../../../../server/questmancer';

const readAction =
  /^(?:live|room|ledger|party-ledger|(?:assets|preview|jobs)\/[0-9a-f-]{36}|(?:party-art|ledger-art)\/\d{1,16})$/;
const writeAction = /^(?:jobs|apply|reveal|move|ledger-capture|ledger-edit|ledger-publish)$/;
const unavailable = (status: number) =>
  Response.json(
    { error: 'Questmancer table unavailable.' },
    {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );

export const ALL: APIRoute = async ({ request, params, url }) => {
  const teamId = params.teamId ?? '';
  const action = params.action ?? '';
  if (!questmancerEnabled(teamId)) return unavailable(404);
  const post = request.method === 'POST';
  const live = action === 'live';
  if (!(post ? writeAction.test(action) : request.method === 'GET' && readAction.test(action)))
    return unavailable(404);
  if ((post || live) && request.headers.get('origin') !== url.origin) return unavailable(403);
  if (live && request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
    return unavailable(426);
  if (post && request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
    return unavailable(415);
  const team = await loadTeam(request, teamId);
  if (team._tag !== 'Ready') return unavailable(team.status);
  return questmancerRequest(
    teamId,
    team.value.currentUserId,
    action,
    post ? request.body : undefined,
  );
};
