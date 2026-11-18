import type { APIRoute } from 'astro';

import { sessionFor } from '../server/backend';

export const GET: APIRoute = async ({ request, redirect }) => {
  const session = await sessionFor(request);
  return redirect(session ? '/app' : '/login', 303);
};
