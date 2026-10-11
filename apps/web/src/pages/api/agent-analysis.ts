import type { APIRoute } from 'astro';
import { Effect } from 'effect';

import { serveAgentAnalysis } from '../../server/agent-analysis/response';

export const prerender = false;
export const POST: APIRoute = ({ request }) => Effect.runPromise(serveAgentAnalysis(request));
